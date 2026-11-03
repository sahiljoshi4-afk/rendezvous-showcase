// T2.4: Generic URL extract mode.
// Fetch a page (plain fetch → fallback to Firecrawl), then use Haiku to extract events.
// sources.config: { url, category, selector_hint? }

import OpenAI from 'openai';
import { z } from 'zod';
import type { RawEvent } from '../types';

const MODEL = 'deepseek-v4-flash';
const BASE_URL = 'https://api.deepseek.com';
const FIRECRAWL_URL = 'https://api.firecrawl.dev/v1/scrape';
const USER_AGENT = 'Rendezvous/0.2 (personal event dashboard)';

let llmCache: OpenAI | null = null;
function llm(): OpenAI {
  if (llmCache) return llmCache;
  llmCache = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY!, baseURL: BASE_URL });
  return llmCache;
}

// ---- Zod ----

const extractedItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  venue_name: z.string().nullable(),
  venue_city: z.string().nullable().default('London'),
  is_virtual: z.boolean().default(false),
  price_currency: z.string().nullable().default('GBP'),
  price_amount: z.number().nullable(),
  url: z.string().nullable(),
  image_url: z.string().nullable().optional(),
  organizer: z.string().nullable(),
});

const extractResultSchema = z.object({
  events: z.array(extractedItemSchema).max(50),
});

// ---- Prompt ----

const EXTRACT_PROMPT = `You extract event listings from web page content. Given the text of a venue or listings page, find every upcoming event and return structured data.

Rules:
- Return ONLY real, upcoming events with specific dates mentioned on the page.
- Skip: past events, generic "about us" text, navigation/menu items, "subscribe to newsletter", social media links.
- For each event, extract: title, description (1-2 sentences), starts_at (ISO 8601), ends_at (if multi-day), venue_name, price_amount (number, null if not mentioned), url (event detail page), organizer.
- If the page lists a show running for a date range, set starts_at to the first date and ends_at to the last.
- Default venue_city to "London", price_currency to "GBP".
- If you're unsure whether something is an event (vs a general article), skip it — false positives are worse than missed events.

Return: { "events": [ ... ] }
Return ONLY the JSON. No prose.`;

// ---- Page fetching ----

async function fetchPage(url: string): Promise<string> {
  // Try plain fetch first
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const html = await res.text();
      return stripHtml(html);
    }
  } catch {
    // Fall through to Firecrawl
  }

  // Firecrawl fallback
  const fcKey = process.env.FIRECRAWL_API_KEY;
  if (!fcKey) throw new Error(`Cannot fetch ${url}: plain fetch failed and no FIRECRAWL_API_KEY`);

  const fcRes = await fetch(FIRECRAWL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fcKey}` },
    body: JSON.stringify({ url, formats: ['markdown'] }),
  });

  if (!fcRes.ok) throw new Error(`Firecrawl failed: ${fcRes.status} for ${url}`);

  const fcData = await fcRes.json() as { data?: { markdown?: string } };
  return fcData.data?.markdown ?? '';
}

// ---- Public API ----

export async function scrapeURL(config: Record<string, unknown>): Promise<RawEvent[]> {
  const url = config.url as string;
  if (!url) throw new Error('URL source missing config.url');

  const category = config.category as string ?? 'culture';
  const timezone = config.timezone as string ?? 'Europe/London';
  const selectorHint = config.selector_hint as string | undefined;

  const pageText = await fetchPage(url);
  if (!pageText || pageText.trim().length < 50) return [];

  // Truncate to keep token cost reasonable
  const truncated = pageText.slice(0, 8000);
  const hint = selectorHint ? `\nFocus on: ${selectorHint}` : '';

  const msg = await llm().chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: EXTRACT_PROMPT },
      { role: 'user', content: `Page URL: ${url}${hint}\n\n---\n\n${truncated}` },
    ],
  });

  const raw = msg.choices[0]?.message?.content ?? '';
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    console.warn('[url] JSON parse failed, raw:', raw.slice(0, 300));
    return [];
  }
  const result = extractResultSchema.parse(parsed);

  return result.events.map((item, i) => ({
    source: '',
    source_id: `url-${hash(url)}-${i}`,
    url: item.url ?? null,
    title: item.title,
    description: item.description ?? null,
    starts_at: item.starts_at ?? null,
    ends_at: item.ends_at ?? null,
    timezone,
    venue_name: item.venue_name ?? null,
    venue_city: item.venue_city ?? null,
    is_virtual: item.is_virtual ?? false,
    price_currency: item.price_currency ?? null,
    price_amount: item.price_amount ?? null,
    organizer: item.organizer ?? null,
    image_url: item.image_url ?? null,
    raw_payload: { source_url: url, category },
  }));
}

// ---- Helpers ----

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).slice(0, 8);
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const candidate = fenced?.[1] ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(candidate);
}
