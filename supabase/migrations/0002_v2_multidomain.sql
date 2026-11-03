-- Rendezvous V2 — multi-domain schema
-- Additive only: no drops, no renames. Runs after 0001_initial.sql.

-- ============================================================
-- events — add V2 columns
-- ============================================================
alter table events add column if not exists category text;
-- 'networking' | 'music' | 'stage' | 'sport' | 'culture'
--   networking = founder/tech events (the V1 domain)
--   music      = gigs, clubs, festivals
--   stage      = theatre, comedy, film screenings
--   sport      = fixtures, matches, races
--   culture    = restaurants, openings, exhibitions, museums

alter table events add column if not exists appeal_score integer;
-- 0-10, universal "how much would Sahil want this". Replaces networking_score
-- as the cross-domain fallback sort. networking_score stays, but only means
-- something for category='networking'.

alter table events add column if not exists facets jsonb not null default '{}'::jsonb;
-- Category-specific structured data. Deliberately schemaless to avoid 40 columns.
--   music:   { artists: [], genres: [], venue_tier: 'intimate'|'mid'|'arena' }
--   stage:   { run_start: iso, run_end: iso, writer: str, director: str, cast: [] }
--   sport:   { teams: [], competition: str }
--   culture: { cuisine: str, kind: 'restaurant'|'exhibition'|'opening' }

alter table events add column if not exists is_run boolean not null default false;
-- true for things with many possible dates (a play running 3 months).
-- When true, starts_at = first performance, facets.run_end = last.
-- Runs must NOT be pushed as time-sensitive individual notifications —
-- they're flexible filler for the week-ahead digest.

alter table events add column if not exists notified_at timestamptz;
-- Set when pushed individually. Prevents re-pushing the same item.

create index if not exists events_category_idx on events (category);
create index if not exists events_appeal_score_idx on events (appeal_score desc);
create index if not exists events_notified_at_idx on events (notified_at);

-- ============================================================
-- sources — config-driven scraper registry
-- ============================================================
create table if not exists sources (
  id            text primary key,          -- 'ra_london', 'timeout_newsletter'
  name          text not null,             -- 'Resident Advisor London'
  mode          text not null,             -- 'api' | 'ics' | 'newsletter' | 'url'
  category      text not null,             -- default category for items from here
  config        jsonb not null default '{}'::jsonb,
                -- mode='ics':        { url }
                -- mode='url':        { url, selector_hint }
                -- mode='newsletter': { from_pattern, subject_pattern }
                -- mode='api':        { adapter: 'ticketmaster' } — needs code
  enabled       boolean not null default true,
  scope_note    text,                      -- 'everything' | 'watchlist artists only'
  created_at    timestamptz not null default now()
);

-- ============================================================
-- attendance — ground truth from email backfill
-- ============================================================
create table if not exists attendance (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid references events(id) on delete set null,  -- usually null
  source_email_id text unique,              -- gmail message id, for idempotency
  title          text not null,
  category       text,
  venue_name     text,
  occurred_at    timestamptz,
  price_amount    numeric,
  price_currency text,
  party_size     integer,
  embedding      vector(1024),
  raw_snippet    text,
  created_at     timestamptz not null default now()
);

create index if not exists attendance_occurred_at_idx on attendance (occurred_at desc);
create index if not exists attendance_category_idx on attendance (category);

-- ============================================================
-- preferences — per-category taste vectors
-- ============================================================
create table if not exists preferences (
  category           text primary key,
  interest_embedding vector(1024),
  sample_count       integer not null default 0,
  updated_at         timestamptz not null default now()
);

-- ============================================================
-- notifications — push log for learning interrupt policy
-- ============================================================
create table if not exists notifications (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid references events(id) on delete cascade,
  channel      text not null,              -- 'telegram' | 'digest' | 'ios'
  kind         text not null,              -- 'individual' | 'weekly_digest'
  score        numeric,                    -- score at time of sending
  reason       text,                        -- the one-line why shown to you
  sent_at      timestamptz not null default now(),
  outcome      text                         -- 'starred' | 'dismissed' | 'ignored' | 'clicked'
);

create index if not exists notifications_sent_at_idx on notifications (sent_at desc);

-- ============================================================
-- people — for companion suggestions (Phase 5)
-- ============================================================
create table if not exists people (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  categories    text[] not null default '{}',  -- what you do with them
  notes         text,
  last_seen_at  timestamptz,                   -- derived from calendar
  cadence_days  integer,                       -- typical gap between meetings
  updated_at    timestamptz not null default now()
);
