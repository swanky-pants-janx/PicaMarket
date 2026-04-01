-- Rate-limiting table for server-side enforcement (vendor submissions, etc.)
create table if not exists rate_limits (
  id bigint generated always as identity primary key,
  key text not null,            -- e.g. "submit-vendor:<email>:<coordinator_id>"
  created_at timestamptz not null default now()
);

-- Fast lookups by key + recency
create index idx_rate_limits_key_created on rate_limits (key, created_at desc);

-- Auto-cleanup: drop rows older than 1 hour (no need to keep stale data)
-- Run via pg_cron or a scheduled Supabase function; this just sets up the table.
