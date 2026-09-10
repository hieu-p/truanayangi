CREATE TABLE IF NOT EXISTS user_food_profiles (
 user_sub TEXT PRIMARY KEY,
 profile TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
