// Generic RSS/Atom feed scraper.
// sources.config must include { url: string, city?: string }.
// Handles standard RSS 2.0 and Atom feeds. No deps — regex-based extraction.

import type { RawEvent } from '../types';

// ponytail: regex-based RSS/Atom parsing instead of a full XML lib.
// Upgrade to fast-xml-parser if feeds start breaking on edge cases.

const USER_AGENT = 'Rendezvous/0.2 (personal event dashboard)';

type FeedItem = {
  title: string;
  link: string | null;
  description: string | null;
  pubDate: string | null;
};

export async function scrapeRSS(config: Record<string, unknown>): Promise<RawEvent[]> {
  const url = config.url as string;
  if (!url) throw new Error('RSS source missing config.url');

  const city = (config.city as string) ?? 'London';
  const timezone = config.timezone as string ?? 'Europe/London';

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, text/xml, application/xml' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${url}`);

  const body = await res.text();
  const items = extractItems(body);

  const events: RawEvent[] = [];
  for (const item of items) {
    const mapped = mapItem(item, city, timezone);
    if (mapped) events.push(mapped);
  }
  return events;
}

function extractItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  // Try RSS 2.0 <item> blocks
  const rssItems = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  for (const block of rssItems) {
    items.push(extractRssItem(block));
  }

  // Try Atom <entry> blocks
  const atomItems = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];
  for (const block of atomItems) {
    items.push(extractAtomEntry(block));
  }

  return items;
}

function extractRssItem(block: string): FeedItem {
  return {
    title: decode(cleanTag(block, 'title')),
    link: cleanTag(block, 'link'),
    description: cleanTag(block, 'description'),
    pubDate: cleanTag(block, 'pubDate'),
  };
}

function extractAtomEntry(block: string): FeedItem {
  // Atom <link> is <link href="..."/> or <link>...</link>
  const linkMatch = block.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/i);
  return {
    title: decode(cleanTag(block, 'title')),
    link: linkMatch?.[1] ?? cleanTag(block, 'link'),
    description: cleanTag(block, 'summary') || cleanTag(block, 'content'),
    pubDate: cleanTag(block, 'published') || cleanTag(block, 'updated'),
  };
}

function mapItem(item: FeedItem, city: string, timezone: string): RawEvent | null {
  if (!item.title) return null;

  // Try to extract venue from description or use the feed's source
  const venue = extractVenue(item.description);
  const date = item.pubDate ? new Date(item.pubDate).toISOString() : null;

  const sourceId = item.link
    ? item.link.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60)
    : slugify(item.title).slice(0, 60);

  return {
    source: '', // filled in by pipeline from sources row
    source_id: sourceId,
    url: item.link,
    title: item.title.slice(0, 500),
    description: item.description?.slice(0, 2000) ?? null,
    starts_at: date,
    ends_at: null,
    timezone,
    venue_name: venue,
    venue_city: venue ? city : null,
    is_virtual: false,
    price_currency: null,
    price_amount: null,
    organizer: null,
    image_url: null,
    raw_payload: { rss_link: item.link, rss_pubDate: item.pubDate },
  };
}

// ---- Helpers ----

function cleanTag(block: string, tag: string): string | null {
  // Handle CDATA-wrapped content
  const cdata = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
  if (cdata) return cdata[1].trim();

  // Handle self-closing <tag attr="val" /> — return null, not useful for text content
  const selfClosing = block.match(new RegExp(`<${tag}[^>]*?\\/>`, 'i'));
  if (selfClosing) return null;

  // Standard opening/closing tag
  const match = block.match(new RegExp(`<${tag}[^>]*?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1]?.trim().replace(/<[^>]*>/g, '').trim() ?? null;
}

function extractVenue(description: string | null): string | null {
  if (!description) return null;
  // Common patterns in event RSS: "Location: Venue Name", "at Venue Name"
  const locMatch = description.match(/Location:\s*(.+?)(?:\.|$|<)/im);
  if (locMatch) return locMatch[1].trim();
  const atMatch = description.match(/\bat\s+([A-Z][^,.<]+?)(?:\.|,|<|$)/m);
  if (atMatch) return atMatch[1].trim();
  return null;
}

function decode(text: string | null): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .trim();
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
