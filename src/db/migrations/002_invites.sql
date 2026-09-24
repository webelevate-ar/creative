-- Team invitations: the owner shares a one-time link (WhatsApp/email); the invitee sets a password.
CREATE TABLE invites (
  token_hash  TEXT PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email       TEXT NOT NULL COLLATE NOCASE,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX invites_org ON invites(org_id);
