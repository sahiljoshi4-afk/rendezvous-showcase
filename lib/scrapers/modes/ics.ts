import ical, { type VEvent } from 'node-ical';
import type { RawEvent } from '../types';

const USER_AGENT = 'Rendezvous/0.2 (personal event dashboard)';

// Generic ICS feed scraper — generalised from the Luma adapter.
// sources.config must include { url: string, timezone?: string, city?: string }.
export async function scrapeICS(config: Record<string, unknown>): Promise<RawEvent[]> {
  const url = config.url as string;
  if (!url) throw new Error('ICS source missing config.url');

  const timezone = (config.timezone as string) ?? 'Europe/London';
  const city = (config.city as string) ?? 'London';

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/calendar' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ICS fetch failed: ${res.status} ${url}`);

  const body = await res.text();
  const parsed = ical.parseICS(body);

  const events: RawEvent[] = [];
  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (item?.type !== 'VEVENT') continue;
    const mapped = mapVEvent(item, city, timezone);
    if (mapped) events.push(mapped);
  }
  return events;
}

function mapVEvent(
  e: VEvent,
  city: string,
  timezone: string,
): RawEvent | null {
  const uid = e.uid;
  const summary = stringOf(e.summary);
  if (!uid || !summary) return null;

  // Use the event's own URL if present, otherwise construct from UID
  const eventUrl = stringOf(e.url) ?? null;
  const sourceId = uid.split('@')[0] || uid;

  const description = stringOf(e.description) ?? null;

  const location = stringOf(e.location) ?? '';
  const isVirtual = /^https?:\/\//i.test(location.trim()) || location === '';
  const venue_name = isVirtual ? null : (location || null);

  return {
    source: '', // filled in by pipeline/runner from the sources row
    source_id: sourceId,
    url: eventUrl,
    title: summary,
    description,
    starts_at: e.start ? e.start.toISOString() : null,
    ends_at: e.end ? e.end.toISOString() : null,
    timezone,
    venue_name,
    venue_city: isVirtual ? null : city,
    is_virtual: isVirtual,
    price_currency: null,
    price_amount: null,
    organizer: extractOrganizer(e.organizer),
    image_url: null,
    raw_payload: { uid, location, organizer: e.organizer },
  };
}

function extractOrganizer(organizer: VEvent['organizer']): string | null {
  if (!organizer) return null;
  if (typeof organizer === 'string') return organizer || null;
  const params = (organizer as { params?: Record<string, string> }).params;
  return params?.CN ?? params?.cn ?? null;
}

function stringOf(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'val' in v && typeof (v as { val: unknown }).val === 'string') {
    return (v as { val: string }).val;
  }
  return undefined;
}
