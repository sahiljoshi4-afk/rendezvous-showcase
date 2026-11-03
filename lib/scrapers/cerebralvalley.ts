import type { RawEvent } from './types';

// Reverse-engineered from cerebralvalley.ai's client bundle — no public API docs.
// Base: https://api.cerebralvalley.ai/v1/public/event/pull
// Query params: approved=true, limit, offset, locations=<LocationTypes key>
// `locations` takes the enum KEY (e.g. "LONDON"), not the human label ("London, UK").
// startDateTime/endDateTime are naive "YYYY-MM-DD HH:MM:SS" strings in UTC (verified
// against a Luma event shared between both sources — times matched exactly once "Z" is appended).
const CITIES = {
  london: { locationKey: 'LONDON', canonical_city: 'London', timezone: 'Europe/London' },
  sf: { locationKey: 'SAN_FRANCISCO', canonical_city: 'San Francisco', timezone: 'America/Los_Angeles' },
  nyc: { locationKey: 'NYC', canonical_city: 'New York', timezone: 'America/New_York' },
} as const;

export type CVCity = keyof typeof CITIES;

const API_BASE = 'https://api.cerebralvalley.ai/v1/public/event/pull';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const PAGE_SIZE = 100;
const MAX_PAGES = 20; // safety cap; raw JSON pagination is cheap, enrichment downstream is not
const MAX_UPCOMING_PER_RUN = 60; // bounds enrichment cost/latency per cron run, mirrors Luma's per-city cap

type CVEvent = {
  id: string;
  name: string;
  description?: string | null;
  startDateTime: string;
  endDateTime?: string | null;
  url?: string | null;
  location?: string | null;
  venue?: string | null;
  imageUrl?: string | null;
};

type CVResponse = {
  events: CVEvent[];
  totalCount: number;
};

export async function scrapeCerebralValley(city: CVCity): Promise<RawEvent[]> {
  const { locationKey, canonical_city, timezone } = CITIES[city];
  const nowMs = Date.now();

  const upcoming: CVEvent[] = [];
  let totalCount = Infinity;
  for (let page = 0; page < MAX_PAGES && page * PAGE_SIZE < totalCount; page++) {
    const offset = page * PAGE_SIZE;
    const url = `${API_BASE}?approved=true&limit=${PAGE_SIZE}&offset=${offset}&locations=${locationKey}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Cerebral Valley ${city} fetch failed: ${res.status}`);
    const data = (await res.json()) as CVResponse;
    totalCount = data.totalCount;
    for (const e of data.events) {
      if (new Date(toIso(e.startDateTime)).getTime() >= nowMs) upcoming.push(e);
    }
  }

  upcoming.sort((a, b) => (a.startDateTime < b.startDateTime ? -1 : 1));
  const capped = upcoming.slice(0, MAX_UPCOMING_PER_RUN);

  const source = `cerebral_valley_${city}`;
  return capped.map((e) => normalizeCVEvent(e, source, canonical_city, timezone));
}

function normalizeCVEvent(
  e: CVEvent,
  source: string,
  fallback_city: string,
  timezone: string,
): RawEvent {
  const isVirtual = e.location === 'Remote';
  const organizer = extractOrganizer(e.description);
  return {
    source,
    source_id: e.id,
    url: e.url || `https://cerebralvalley.ai/events/~/e/${e.id}`,
    title: e.name,
    description: e.description ?? null,
    starts_at: toIso(e.startDateTime),
    ends_at: e.endDateTime ? toIso(e.endDateTime) : null,
    timezone,
    venue_name: e.venue || null,
    venue_city: isVirtual ? null : fallback_city,
    is_virtual: isVirtual,
    price_currency: null,
    price_amount: null,
    organizer,
    image_url: e.imageUrl || null,
    raw_payload: e,
  };
}

// CV's startDateTime/endDateTime are naive UTC strings ("YYYY-MM-DD HH:MM:SS").
function toIso(naive: string): string {
  return `${naive.replace(' ', 'T')}Z`;
}

function extractOrganizer(description?: string | null): string | null {
  if (!description) return null;
  const match = description.match(/Hosted by[:\s]+([^\n.]{3,80})/i);
  return match ? match[1].trim() : null;
}
