CREATE TABLE IF NOT EXISTS profile_oauth_states (
  state_hash TEXT PRIMARY KEY,
  binding_hash TEXT NOT NULL,
  verifier TEXT NOT NULL,
  origin TEXT NOT NULL,
  challenge TEXT NOT NULL,
  nonce TEXT NOT NULL,
  callback_mode TEXT NOT NULL CHECK(callback_mode IN ('project','root')),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS profile_oauth_expiry ON profile_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS profile_tickets (
  ticket_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  login TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  origin TEXT NOT NULL,
  challenge TEXT NOT NULL,
  nonce_hash TEXT NOT NULL,
  callback_mode TEXT NOT NULL CHECK(callback_mode IN ('project','root')),
  manager_access_status TEXT NOT NULL CHECK(manager_access_status IN ('ready','not_admin','restricted','unavailable')),
  manager_access_code TEXT,
  manager_session_hash TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS profile_ticket_expiry ON profile_tickets(expires_at);
CREATE INDEX IF NOT EXISTS profile_ticket_user ON profile_tickets(user_id);

CREATE TABLE IF NOT EXISTS profile_sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  login TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  manager_access_status TEXT NOT NULL CHECK(manager_access_status IN ('ready','not_admin','restricted','unavailable')),
  manager_access_code TEXT,
  manager_session_hash TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS profile_session_expiry ON profile_sessions(expires_at);
CREATE INDEX IF NOT EXISTS profile_session_user ON profile_sessions(user_id);
