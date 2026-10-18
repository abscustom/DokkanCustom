-- Immutable Git blob cache, not another source of card data.
CREATE TABLE IF NOT EXISTS card_metadata (
  cache_key TEXT PRIMARY KEY,
  metadata TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS card_metadata_created ON card_metadata(created_at);
