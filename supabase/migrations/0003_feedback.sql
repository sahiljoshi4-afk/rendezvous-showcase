-- Add post-attendance feedback to interactions
-- Only run what's missing — idempotent

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_name = 'interactions' and column_name = 'rating') then
    alter table interactions add column rating integer check (rating >= 1 and rating <= 5);
  end if;

  if not exists (select 1 from information_schema.columns
    where table_name = 'interactions' and column_name = 'feedback_text') then
    alter table interactions add column feedback_text text;
  end if;

  if not exists (select 1 from information_schema.columns
    where table_name = 'interactions' and column_name = 'attended') then
    alter table interactions add column attended boolean not null default false;
  end if;

  -- Add a unique constraint so upserts work on (event_id)
  -- Drop the old one if it exists on a different column set
  if not exists (select 1 from information_schema.table_constraints
    where table_name = 'interactions' and constraint_name = 'interactions_event_id_key') then
    -- Check if there's an existing unique on (event_id, action) or similar
    perform 1 from pg_indexes where tablename = 'interactions' and indexname like '%event_id%';
    if not found then
      -- Create a partial unique index: one row per event, action can change
      -- This allows star→dismiss updates while keeping one row per event
      create unique index if not exists interactions_event_id_key on interactions (event_id);
    end if;
  end if;
end $$;
