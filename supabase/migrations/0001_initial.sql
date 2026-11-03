-- Rendezvous — initial schema
-- Paste this into Supabase SQL Editor and run.
-- Prerequisite: enable the "vector" extension in Database → Extensions.

create extension if not exists vector;

-- ============================================================
-- events
-- ============================================================
create table if not exists events (
  id                              uuid primary key default gen_random_uuid(),
  source                          text not null,
  source_id                       text not null,
  url                             text,
  title                           text not null,
  description                     text,
  starts_at                       timestamptz,
  ends_at                         timestamptz,
  timezone                        text,
  venue_name                      text,
  venue_city                      text,
  is_virtual                      boolean not null default false,
  virtual_accessible_from_london  boolean not null default false,
  price_currency                  text,
  price_amount                    numeric,
  capacity                        integer,
  seats_left                      integer,
  organizer                       text,
  organizer_type                  text,
  image_url                       text,
  raw_payload                     jsonb,
  tags                            text[] not null default '{}',
  format                          text,
  networking_score                integer,
  founder_density                 text,
  embedding                       vector(1024),
  first_seen_at                   timestamptz not null default now(),
  last_seen_at                    timestamptz not null default now(),
  status                          text not null default 'active',
  constraint events_source_id_unique unique (source, source_id),
  constraint events_status_check check (status in ('active', 'stale', 'past', 'hidden')),
  constraint events_founder_density_check check (
    founder_density is null or founder_density in ('high', 'medium', 'low', 'unknown')
  ),
  constraint events_networking_score_range check (
    networking_score is null or (networking_score >= 0 and networking_score <= 10)
  )
);

create index if not exists events_starts_at_idx on events (starts_at);
create index if not exists events_status_idx on events (status);
create index if not exists events_venue_city_idx on events (venue_city);
create index if not exists events_tags_idx on events using gin (tags);
create index if not exists events_embedding_idx on events using hnsw (embedding vector_cosine_ops);

-- ============================================================
-- profile (single row for the single user)
-- ============================================================
create table if not exists profile (
  id                    uuid primary key default gen_random_uuid(),
  email                 text unique,
  display_name          text,
  tags                  text[] not null default '{}',
  interests             text,
  interest_embedding    vector(1024),
  city_bias             jsonb not null default '{"London": 1.0, "San Francisco": 0.7, "New York": 0.7, "virtual_gmt": 0.6}'::jsonb,
  format_bias           jsonb not null default '{"dinner": 1.3, "drinks": 1.2, "networking": 1.2, "workshop": 1.0, "demo_day": 1.15, "hackathon": 1.05, "talk": 0.85, "panel": 0.7, "conference": 0.5}'::jsonb,
  onboarded_at          timestamptz,
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- interactions
-- ============================================================
create table if not exists interactions (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  action        text not null,
  created_at    timestamptz not null default now(),
  constraint interactions_action_check check (
    action in ('view', 'save', 'dismiss', 'add_to_calendar', 'going', 'not_interested', 'interested')
  )
);

create index if not exists interactions_event_id_idx on interactions (event_id);
create index if not exists interactions_action_idx on interactions (action);

-- ============================================================
-- sources_health
-- ============================================================
create table if not exists sources_health (
  source                     text primary key,
  last_run_at                timestamptz,
  last_success_at            timestamptz,
  last_error                 text,
  events_found_last_run      integer,
  events_new_last_run        integer,
  updated_at                 timestamptz not null default now()
);

-- ============================================================
-- Coach: chat_messages, chat_summaries, learned_preferences
-- ============================================================
create table if not exists chat_messages (
  id              uuid primary key default gen_random_uuid(),
  role            text not null,
  content         text not null,
  tool_calls      jsonb,
  tool_results    jsonb,
  created_at      timestamptz not null default now(),
  constraint chat_messages_role_check check (role in ('user', 'assistant', 'system', 'tool'))
);

create index if not exists chat_messages_created_at_idx on chat_messages (created_at desc);

create table if not exists chat_summaries (
  id                     uuid primary key default gen_random_uuid(),
  summary                text not null,
  covers_messages_upto   uuid references chat_messages(id),
  created_at             timestamptz not null default now()
);

create table if not exists learned_preferences (
  id                uuid primary key default gen_random_uuid(),
  key               text not null,
  value             text not null,
  confidence        numeric not null default 0.7,
  source_message_id uuid references chat_messages(id),
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  constraint learned_preferences_confidence_range check (confidence >= 0 and confidence <= 1)
);

create index if not exists learned_preferences_key_idx on learned_preferences (key) where active;
