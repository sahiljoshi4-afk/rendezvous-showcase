import { supabaseAdmin } from '../db/client';
import { embed } from '../embed/openai';
import { enrichEvent } from '../extract/claude';
import type { EnrichedEvent, RawEvent } from './types';

export type PipelineResult = {
  source: string;
  fetched: number;
  written: number;
  errors: number;
  error_samples: string[];
};

const CONCURRENCY = 4;

export async function runPipeline(
  source: string,
  scrape: () => Promise<RawEvent[]>,
): Promise<PipelineResult> {
  const started = new Date();
  let raw: RawEvent[];
  try {
    raw = await scrape();
  } catch (err) {
    await recordHealth(source, {
      last_run_at: started.toISOString(),
      last_error: errString(err),
      events_found_last_run: 0,
    });
    throw err;
  }

  const errors: string[] = [];
  const enriched: EnrichedEvent[] = [];

  // Enrich in bounded parallel batches — Haiku + Voyage per event.
  for (let i = 0; i < raw.length; i += CONCURRENCY) {
    const chunk = raw.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(enrichOne));
    for (const r of results) {
      if (r.status === 'fulfilled') enriched.push(r.value);
      else errors.push(errString(r.reason));
    }
  }

  const written = await upsertEvents(enriched);

  await recordHealth(source, {
    last_run_at: started.toISOString(),
    last_success_at: started.toISOString(),
    last_error: errors[0] ?? null,
    events_found_last_run: raw.length,
    events_new_last_run: written,
  });

  return {
    source,
    fetched: raw.length,
    written,
    errors: errors.length,
    error_samples: errors.slice(0, 3),
  };
}

async function enrichOne(raw: RawEvent): Promise<EnrichedEvent> {
  const enrichment = await enrichEvent(raw);
  const embedText = [
    raw.title,
    enrichment.cleaned_description ?? raw.description ?? '',
    (enrichment.tags ?? []).join(', '),
    raw.organizer ?? '',
  ]
    .filter(Boolean)
    .join('\n');
  const [embedding] = await embed([embedText]);
  return {
    ...raw,
    description: enrichment.cleaned_description ?? raw.description,
    category: enrichment.category,
    appeal_score: enrichment.appeal_score,
    facets: enrichment.facets,
    tags: enrichment.tags,
    format: enrichment.format,
    networking_score: enrichment.networking_score ?? null,
    founder_density: enrichment.founder_density ?? null,
    organizer_type: enrichment.organizer_type ?? null,
    embedding,
  };
}

async function upsertEvents(events: EnrichedEvent[]): Promise<number> {
  if (events.length === 0) return 0;
  const db = supabaseAdmin();
  const rows = events.map((e) => ({
    source: e.source,
    source_id: e.source_id,
    url: e.url,
    title: e.title,
    description: e.description,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    timezone: e.timezone,
    venue_name: e.venue_name,
    venue_city: e.venue_city,
    is_virtual: e.is_virtual,
    virtual_accessible_from_london: e.is_virtual, // refined in a later pass
    price_currency: e.price_currency,
    price_amount: e.price_amount,
    organizer: e.organizer,
    organizer_type: e.organizer_type,
    image_url: e.image_url,
    raw_payload: e.raw_payload,
    category: e.category,
    appeal_score: e.appeal_score,
    facets: e.facets,
    tags: e.tags,
    format: e.format,
    networking_score: e.networking_score,
    founder_density: e.founder_density,
    embedding: e.embedding,
    last_seen_at: new Date().toISOString(),
    status: 'active',
  }));
  const { error, count } = await db
    .from('events')
    .upsert(rows, { onConflict: 'source,source_id', count: 'exact' });
  if (error) throw new Error(`Upsert failed: ${error.message}`);
  return count ?? rows.length;
}

async function recordHealth(
  source: string,
  fields: {
    last_run_at?: string;
    last_success_at?: string | null;
    last_error?: string | null;
    events_found_last_run?: number;
    events_new_last_run?: number;
  },
): Promise<void> {
  try {
    const db = supabaseAdmin();
    await db
      .from('sources_health')
      .upsert({ source, ...fields, updated_at: new Date().toISOString() });
  } catch {
    // Health writes must never block the pipeline.
  }
}

function errString(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
