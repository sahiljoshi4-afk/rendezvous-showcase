import ical, { type VEvent } from 'node-ical';
import type { RawEvent } from './types';

const CITIES = {
  london: {
    discplace: 'discplace-QCcNk3HXowOR97j',
    canonical_city: 'London',
    timezone: 'Europe/London',
  },
  sf: {
    discplace: 'discplace-BDj7GNbGlsF7Cka',
    canonical_city: 'San Francisco',
    timezone: 'America/Los_Angeles',
  },
  nyc: {
    discplace: 'discplace-Izx1rQVSh8njYpP',
    canonical_city: 'New York',
    timezone: 'America/New_York',
  },
} as const;

export type LumaCity = keyof typeof CITIES;

const USER_AGENT = 'Rendezvous/0.1 (personal event dashboard)';

export async function scrapeLuma(city: LumaCity): Promise<RawEvent[]> {
  const { discplace, canonical_city, timezone } = CITIES[city];
  const url = `https://api.luma.com/ics/get?entity=discover&id=${discplace}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/calendar' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Luma ${city} ICS fetch failed: ${res.status}`);
  const body = await res.text();
  const parsed = ical.parseICS(body);

  const source = `luma_${city}`;
  const events: RawEvent[] = [];
  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (item?.type !== 'VEVENT') continue;
    const mapped = mapVEvent(item, source, canonical_city, timezone);
    if (mapped) events.push(mapped);
  }
  return events;
}

function mapVEvent(
  e: VEvent,
  source: string,
  fallback_city: string,
  timezone: string,
): RawEvent | null {
  const uid = e.uid;
  const summary = stringOf(e.summary);
  if (!uid || !summary) return null;

  // UID format: "evt-XXXX@events.lu.ma" -> "evt-XXXX"
  const sourceId = uid.split('@')[0];

  const rawDescription = stringOf(e.description);
  const description = cleanDescription(rawDescription);
  const eventUrl = extractLumaUrl(rawDescription) ?? `https://lu.ma/${sourceId}`;

  // Distinguish virtual events by whether LOCATION is a URL vs a physical address.
  const location = stringOf(e.location) ?? '';
  const isVirtual = /^https?:\/\//i.test(location.trim()) || location === '';
  const venue_name = isVirtual ? null : location;

  const organizer = extractOrganizerName(e.organizer);

  return {
    source,
    source_id: sourceId,
    url: eventUrl,
    title: summary,
    description,
    starts_at: e.start ? e.start.toISOString() : null,
    ends_at: e.end ? e.end.toISOString() : null,
    timezone,
    venue_name,
    venue_city: isVirtual ? null : fallback_city,
    is_virtual: isVirtual,
    price_currency: null,
    price_amount: null,
    organizer,
    image_url: null,
    raw_payload: { uid, location, organizer: e.organizer },
  };
}

function extractLumaUrl(description: string | undefined): string | null {
  if (!description) return null;
  const match = description.match(/https?:\/\/(?:lu\.ma|luma\.com)\/[a-zA-Z0-9_-]+/);
  return match ? match[0].replace('luma.com', 'lu.ma') : null;
}

function cleanDescription(description: string | undefined): string | null {
  if (!description) return null;
  // Strip the "Get up-to-date information at: <url>" preamble and the "Address:" block Luma adds.
  const cleaned = description
    .replace(/^Get up-to-date information at:\s*https?:\/\/\S+\s*/i, '')
    .replace(/Address:\n[\s\S]+?\n\n/i, '')
    .trim();
  return cleaned || null;
}

function extractOrganizerName(organizer: VEvent['organizer']): string | null {
  if (!organizer) return null;
  if (typeof organizer === 'string') return organizer || null;
  const params = (organizer as { params?: Record<string, string> }).params;
  return params?.CN ?? params?.cn ?? null;
}

// node-ical wraps values in `{ val, params }` when the field has parameters (LANGUAGE, TZID, etc).
// Unwrap to a plain string, tolerating both shapes.
function stringOf(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'val' in v && typeof (v as { val: unknown }).val === 'string') {
    return (v as { val: string }).val;
  }
  return undefined;
}
