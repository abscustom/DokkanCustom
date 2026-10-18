PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  status TEXT NOT NULL CHECK (status IN ('published', 'draft', 'archived')),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  rarity TEXT NOT NULL,
  card_class TEXT,
  release_date TEXT,
  category_names_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(category_names_json)),
  card_art_image_url TEXT,
  card_art_video_url TEXT,
  unit_tag TEXT,
  awakening_mode TEXT,
  thumb TEXT,
  repo_path TEXT NOT NULL UNIQUE,
  asset_base TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  builtin_forms_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(builtin_forms_json)),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  source_checksum TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS cards_public_catalog ON cards(status, id);
CREATE INDEX IF NOT EXISTS cards_public_filters ON cards(status, type, rarity, card_class, release_date, id);

CREATE TABLE IF NOT EXISTS card_aliases (
  path TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  provenance TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS card_aliases_card ON card_aliases(card_id, path);

CREATE TABLE IF NOT EXISTS card_form_links (
  left_id TEXT NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  right_id TEXT NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (left_id, right_id),
  CHECK (left_id < right_id)
);
CREATE INDEX IF NOT EXISTS card_form_links_right ON card_form_links(right_id, left_id);

CREATE TABLE IF NOT EXISTS card_revisions (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  actor TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (card_id, revision)
);
CREATE INDEX IF NOT EXISTS card_revisions_recent ON card_revisions(card_id, revision DESC);

CREATE TABLE IF NOT EXISTS card_import_runs (
  run_id TEXT PRIMARY KEY,
  source_checksum TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'applied', 'partial', 'blocked')),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  report_json TEXT NOT NULL CHECK (json_valid(report_json))
);

CREATE TABLE IF NOT EXISTS card_import_items (
  run_id TEXT NOT NULL REFERENCES card_import_runs(run_id) ON DELETE CASCADE,
  source_path TEXT NOT NULL,
  card_id TEXT,
  source_checksum TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('inserted', 'updated', 'unchanged', 'conflict', 'blocked')),
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  PRIMARY KEY (run_id, source_path)
);
