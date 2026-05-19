CREATE TABLE IF NOT EXISTS monad_releases (
  id SERIAL PRIMARY KEY,
  tag_name TEXT NOT NULL UNIQUE,
  published_at TIMESTAMPTZ NOT NULL,
  html_url TEXT NOT NULL,
  body TEXT,
  is_prerelease BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monad_releases_published
  ON monad_releases (published_at DESC);
