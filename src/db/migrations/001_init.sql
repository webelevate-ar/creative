-- Remarcá initial schema. Money in integer cents. Every business table carries org_id.

CREATE TABLE orgs (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TEXT NOT NULL,
  paid_until    TEXT,
  -- Pricing defaults: cost basis, IVA, markup, rounding, export template.
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE users (
  id             INTEGER PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'owner',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at  TEXT
);
CREATE INDEX users_org ON users(org_id);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  csrf_token  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE password_resets (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);

CREATE TABLE suppliers (
  id                  INTEGER PRIMARY KEY,
  org_id              INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS','USD')),
  exchange_rate       REAL NOT NULL DEFAULT 1,
  list_includes_iva   INTEGER NOT NULL DEFAULT 0,
  iva_rate            REAL NOT NULL DEFAULT 21,
  discounts           TEXT NOT NULL DEFAULT '',
  surcharge_pct       REAL NOT NULL DEFAULT 0,
  markup_pct          REAL,               -- NULL = use the org default
  price_mode          TEXT CHECK (price_mode IN ('keep_margin','markup')), -- NULL = org default
  price_per_pack      INTEGER NOT NULL DEFAULT 0,
  mapping_json        TEXT,               -- remembered column mapping for this supplier's files
  last_list_at        TEXT,
  archived            INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX suppliers_org_name ON suppliers(org_id, name COLLATE NOCASE);

CREATE TABLE products (
  id                  INTEGER PRIMARY KEY,
  org_id              INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  code                TEXT NOT NULL,
  code_norm           TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  search_text         TEXT NOT NULL DEFAULT '',
  supplier_id         INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_code       TEXT,
  supplier_code_norm  TEXT,
  cost_cents          INTEGER,
  price_cents         INTEGER,
  markup_pct          REAL,               -- NULL = supplier/org default
  iva_rate            REAL,               -- NULL = supplier default
  cost_updated_at     TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX products_org_code ON products(org_id, code);
CREATE INDEX products_org_code_norm ON products(org_id, code_norm);
CREATE INDEX products_supplier_code ON products(org_id, supplier_id, supplier_code_norm);

-- Learned equivalences: "this supplier's code X is my product Y".
CREATE TABLE code_links (
  org_id              INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  supplier_id         INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_code_norm  TEXT NOT NULL,
  product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (org_id, supplier_id, supplier_code_norm)
);

CREATE TABLE imports (
  id            INTEGER PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  supplier_id   INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_size     INTEGER NOT NULL,
  file_blob     BLOB,
  file_kind     TEXT NOT NULL,
  sheet_name    TEXT,
  mapping_json  TEXT,
  rules_json    TEXT,                 -- pricing rules snapshot used for this import
  status        TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','review','applied','reverted','discarded')),
  stats_json    TEXT NOT NULL DEFAULT '{}',
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  applied_at    TEXT,
  reverted_at   TEXT
);
CREATE INDEX imports_org ON imports(org_id, created_at);
CREATE INDEX imports_supplier ON imports(org_id, supplier_id);

CREATE TABLE import_rows (
  id               INTEGER PRIMARY KEY,
  import_id        INTEGER NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  org_id           INTEGER NOT NULL,
  row_index        INTEGER NOT NULL,
  raw_code         TEXT NOT NULL,
  code_norm        TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  raw_price        TEXT NOT NULL DEFAULT '',
  list_price       REAL,               -- in list currency, before rules
  pack_qty         INTEGER,
  product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
  match_type       TEXT NOT NULL DEFAULT 'none' CHECK (match_type IN ('link','supplier_code','own_code','manual','none')),
  old_cost_cents   INTEGER,
  new_cost_cents   INTEGER,
  old_price_cents  INTEGER,
  new_price_cents  INTEGER,
  flags            TEXT NOT NULL DEFAULT '',
  decision         TEXT NOT NULL DEFAULT 'skip' CHECK (decision IN ('apply','skip','create'))
);
CREATE INDEX import_rows_import ON import_rows(import_id, row_index);
CREATE INDEX import_rows_product ON import_rows(import_id, product_id);

CREATE TABLE price_history (
  id               INTEGER PRIMARY KEY,
  org_id           INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  import_id        INTEGER REFERENCES imports(id) ON DELETE SET NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('update','create','manual','revert')),
  old_cost_cents   INTEGER,
  new_cost_cents   INTEGER,
  old_price_cents  INTEGER,
  new_price_cents  INTEGER,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX price_history_product ON price_history(org_id, product_id, created_at);
CREATE INDEX price_history_import ON price_history(import_id);

-- Catalog files between "upload" and "confirm mapping". Deleted after import.
CREATE TABLE catalog_uploads (
  id          INTEGER PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_blob   BLOB NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX catalog_uploads_org ON catalog_uploads(org_id);

-- Product analytics (first-party, no third-party trackers).
CREATE TABLE events (
  id          INTEGER PRIMARY KEY,
  org_id      INTEGER,
  user_id     INTEGER,
  name        TEXT NOT NULL,
  props_json  TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX events_name ON events(name, created_at);
CREATE INDEX events_org ON events(org_id, created_at);
