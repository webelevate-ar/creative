import { z } from 'zod';
import type { DB } from '../db/index.js';
import { dummyPasswordHash, hashPassword, randomToken, sha256, verifyPassword } from '../lib/security.js';
import { TRIAL_DAYS } from '../lib/plans.js';

export const SESSION_DAYS = 30;
const RESET_MINUTES = 60;

export const emailSchema = z.string().trim().toLowerCase().max(254).email('Ingresá un email válido.');
export const passwordSchema = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(200, 'La contraseña es demasiado larga.');

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá tu nombre.').max(80),
  business: z.string().trim().min(2, 'Ingresá el nombre del comercio.').max(100),
  email: emailSchema,
  password: passwordSchema,
});

export interface SessionUser {
  userId: number;
  orgId: number;
  email: string;
  name: string;
  role: string;
  csrf: string;
  tokenHash: string;
}

export class AuthError extends Error {}

export async function signup(db: DB, input: z.infer<typeof signupSchema>): Promise<{ userId: number; orgId: number }> {
  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(input.email);
  if (exists) throw new AuthError('Ya existe una cuenta con ese email. ¿Querés ingresar?');
  const hash = await hashPassword(input.password);
  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
  return db.transaction(() => {
    // Re-check inside the transaction: two concurrent signups with the same email.
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(input.email)) throw new AuthError('Ya existe una cuenta con ese email. ¿Querés ingresar?');
    const org = db.prepare("INSERT INTO orgs (name, plan, trial_ends_at) VALUES (?, 'trial', ?)").run(input.business, trialEnds);
    const orgId = Number(org.lastInsertRowid);
    const user = db.prepare("INSERT INTO users (org_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'owner')").run(orgId, input.email, input.name, hash);
    return { userId: Number(user.lastInsertRowid), orgId };
  })();
}

export async function login(db: DB, emailRaw: string, password: string): Promise<{ userId: number; orgId: number } | null> {
  const email = emailRaw.trim().toLowerCase();
  const user = db.prepare('SELECT id, org_id, password_hash FROM users WHERE email = ?').get(email) as
    | { id: number; org_id: number; password_hash: string }
    | undefined;
  if (!user) {
    // Same work as a real check, so response time does not reveal which emails exist.
    await verifyPassword(password, await dummyPasswordHash());
    return null;
  }
  if (!(await verifyPassword(password, user.password_hash))) return null;
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), user.id);
  return { userId: user.id, orgId: user.org_id };
}

export function createSession(db: DB, userId: number, orgId: number): { token: string; expiresAt: Date } {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, org_id, csrf_token, expires_at) VALUES (?, ?, ?, ?, ?)').run(
    sha256(token),
    userId,
    orgId,
    randomToken(24),
    expiresAt.toISOString(),
  );
  // Opportunistic cleanup of expired sessions.
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  return { token, expiresAt };
}

export function getSession(db: DB, token: string | undefined): SessionUser | null {
  if (!token || token.length > 100) return null;
  const tokenHash = sha256(token);
  const row = db
    .prepare(
      `SELECT s.user_id, s.org_id, s.csrf_token, s.expires_at, u.email, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id AND u.org_id = s.org_id
       WHERE s.token_hash = ?`,
    )
    .get(tokenHash) as
    | { user_id: number; org_id: number; csrf_token: string; expires_at: string; email: string; name: string; role: string }
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  return { userId: row.user_id, orgId: row.org_id, email: row.email, name: row.name, role: row.role, csrf: row.csrf_token, tokenHash };
}

export function destroySession(db: DB, tokenHash: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function destroyAllSessions(db: DB, userId: number): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

/** Returns a reset token for an existing email, or null. Callers must respond identically either way. */
export function createPasswordReset(db: DB, emailRaw: string): { token: string; email: string } | null {
  const email = emailRaw.trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (!user) return null;
  const token = randomToken();
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
  db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(token),
    user.id,
    new Date(Date.now() + RESET_MINUTES * 60_000).toISOString(),
  );
  return { token, email };
}

export function checkResetToken(db: DB, token: string): number | null {
  if (!token || token.length > 100) return null;
  const row = db.prepare('SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?').get(sha256(token)) as
    | { user_id: number; expires_at: string; used_at: string | null }
    | undefined;
  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row.user_id;
}

export async function resetPassword(db: DB, token: string, password: string): Promise<boolean> {
  const userId = checkResetToken(db, token);
  if (userId == null) return false;
  const hash = await hashPassword(password);
  return db.transaction(() => {
    // Mark used atomically; a second concurrent use sees changes === 0.
    const used = db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL').run(new Date().toISOString(), sha256(token));
    if (used.changes !== 1) return false;
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
    destroyAllSessions(db, userId);
    return true;
  })();
}

export async function changePassword(db: DB, userId: number, current: string, next: string): Promise<boolean> {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined;
  if (!row || !(await verifyPassword(current, row.password_hash))) return false;
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), userId);
  return true;
}
