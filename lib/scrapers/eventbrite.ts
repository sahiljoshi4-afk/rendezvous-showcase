import type { RawEvent } from './types';

const CITIES = {
  london: { slug: 'united-kingdom--london', canonical_city: 'London' },
  sf: { slug: 'ca--san-francisco', canonical_city: 'San Francisco' },
  nyc: { slug: 'ny--new-york', canonical_city: 'New York' },
} as const;

export type EventbriteCity = keyof typeof CITIES;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Rendezvous/0.1';

// Broad query — Claude scores irrelevant panels/conferences down to 0-3 anyway,
// so we favour volume and let ranking do the filtering.
const QUERY = 'tech';

export async function scrapeEventbrite(city: EventbriteCity): Promise<RawEvent[]> {
  const { slug, canonical_city } = CITIES[city];
  const url = `https://www.eventbrite.com/d/${slug}/${QUERY}--events/`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Eventbrite ${city} fetch failed: ${res.status}`);
  const html = await res.text();
  const match = html.match(/window\.__SERVER_DATA__\s*=\s*(\{[\s\S]+?\});/);
  if (!match) throw new Error(`No __SERVER_DATA__ block in Eventbrite ${city} page`);
  const data = JSON.parse(match[1]);
  const results: EventbriteEvent[] = data?.search_data?.events?.results ?? [];
  const source = `eventbrite_${city}`;
  return results.map((e) => normalizeEventbrite(e, source, canonical_city));
}

type EventbriteEvent = {
  id: string;
  eventbrite_event_id?: string;
  name: string;
  summary?: string;
  full_description?: string | null;
  url?: string;
  tickets_url?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  timezone?: string;
  is_online_event?: boolean;
  image?: { url?: string; original?: { url?: string } };
  primary_venue?: {
    name?: string;
    address?: { city?: string; localized_address_display?: string };
  };
  primary_organizer_id?: string;
  tags?: Array<{ display_name?: string }>;
};

function normalizeEventbrite(
  e: EventbriteEvent,
  source: string,
  fallback_city: string,
): RawEvent {
  const startsAt = combineIso(e.start_date, e.start_time);
  const endsAt = combineIso(e.end_date, e.end_time);
  const venue = e.primary_venue;
  return {
    source,
    source_id: String(e.id),
    url: e.url ?? null,
    title: e.name,
    description: e.summary ?? e.full_description ?? null,
    starts_at: startsAt,
    ends_at: endsAt,
    timezone: e.timezone ?? null,
    venue_name: venue?.name ?? venue?.address?.localized_address_display ?? null,
    venue_city: venue?.address?.city ?? (e.is_online_event ? null : fallback_city),
    is_virtual: Boolean(e.is_online_event),
    price_currency: null,
    price_amount: null,
    organizer: e.primary_organizer_id ? `Eventbrite organizer ${e.primary_organizer_id}` : null,
    image_url: e.image?.original?.url ?? e.image?.url ?? null,
    raw_payload: e,
  };
}

function combineIso(
  date: string | undefined,
  time: string | undefined,
): string | null {
  if (!date) return null;
  // Store as UTC-labelled wall-clock; the `timezone` column is authoritative for display.
  return `${date}T${time ?? '00:00'}:00.000Z`;
}
