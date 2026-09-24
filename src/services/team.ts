import type { DB } from '../db/index.js';
import { hashPassword, randomToken, sha256 } from '../lib/security.js';

const INVITE_DAYS = 7;

export class TeamError extends Error {}

export function listMembers(db: DB, orgId: number) {
  return db.prepare('SELECT id, name, email, role, created_at, last_login_at FROM users WHERE org_id = ? ORDER BY id').all(orgId) as {
    id: number;
    name: string;
    email: string;
    role: string;
    created_at: string;
    last_login_at: string | null;
  }[];
}

export function listPendingInvites(db: DB, orgId: number) {
  return db
    .prepare('SELECT email, expires_at, created_at FROM invites WHERE org_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC')
    .all(orgId, new Date().toISOString()) as { email: string; expires_at: string; created_at: string }[];
}

/** Seats used = members + pending invites. */
export function seatsUsed(db: DB, orgId: number): number {
  const members = db.prepare('SELECT COUNT(*) FROM users WHERE org_id = ?').pluck().get(orgId) as number;
  return members + listPendingInvites(db, orgId).length;
}

export function createInvite(db: DB, orgId: number, byUserId: number, emailRaw: string, maxUsers: number): string {
  const email = emailRaw.trim().toLowerCase();
  return db.transaction(() => {
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new TeamError('Ese email ya tiene una cuenta en Remarcá.');
    db.prepare('DELETE FROM invites WHERE org_id = ? AND email = ? AND used_at IS NULL').run(orgId, email);
    if (seatsUsed(db, orgId) >= maxUsers) throw new TeamError(`Tu plan permite hasta ${maxUsers} usuario${maxUsers > 1 ? 's' : ''}.`);
    const token = randomToken();
    db.prepare('INSERT INTO invites (token_hash, org_id, email, created_by, expires_at) VALUES (?, ?, ?, ?, ?)').run(
      sha256(token),
      orgId,
      email,
      byUserId,
      new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
    );
    return token;
  })();
}

export function revokeInvite(db: DB, orgId: number, email: string): void {
  db.prepare('DELETE FROM invites WHERE org_id = ? AND email = ? AND used_at IS NULL').run(orgId, email.trim().toLowerCase());
}

export function findInvite(db: DB, token: string): { orgId: number; email: string; orgName: string } | null {
  if (!token || token.length > 100) return null;
  const row = db
    .prepare('SELECT i.org_id, i.email, o.name FROM invites i JOIN orgs o ON o.id = i.org_id WHERE i.token_hash = ? AND i.used_at IS NULL AND i.expires_at > ?')
    .get(sha256(token), new Date().toISOString()) as { org_id: number; email: string; name: string } | undefined;
  return row ? { orgId: row.org_id, email: row.email, orgName: row.name } : null;
}

export async function acceptInvite(db: DB, token: string, name: string, password: string): Promise<{ userId: number; orgId: number } | null> {
  const invite = findInvite(db, token);
  if (!invite) return null;
  const hash = await hashPassword(password);
  return db.transaction(() => {
    const used = db.prepare('UPDATE invites SET used_at = ? WHERE token_hash = ? AND used_at IS NULL').run(new Date().toISOString(), sha256(token));
    if (used.changes !== 1) return null;
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(invite.email)) throw new TeamError('Ese email ya tiene una cuenta en Remarcá.');
    const r = db.prepare("INSERT INTO users (org_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'member')").run(invite.orgId, invite.email, name, hash);
    return { userId: Number(r.lastInsertRowid), orgId: invite.orgId };
  })();
}

export function removeMember(db: DB, orgId: number, actorId: number, userId: number): void {
  if (actorId === userId) throw new TeamError('No podés quitarte a vos mismo.');
  const target = db.prepare('SELECT role FROM users WHERE id = ? AND org_id = ?').get(userId, orgId) as { role: string } | undefined;
  if (!target) throw new TeamError('Usuario no encontrado.');
  if (target.role === 'owner') throw new TeamError('No se puede quitar al titular de la cuenta.');
  db.prepare('DELETE FROM users WHERE id = ? AND org_id = ?').run(userId, orgId);
}
