CREATE TABLE IF NOT EXISTS password_sessions (
  id_hash TEXT PRIMARY KEY,
  profile_hash TEXT NOT NULL UNIQUE,
  origin TEXT NOT NULL,
  csrf TEXT NOT NULL,
  credential_version TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS password_sessions_expiry ON password_sessions(expires_at);
CREATE TABLE IF NOT EXISTS password_attempts (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
