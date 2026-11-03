import OpenAI from 'openai';
import {
  enrichmentSchema,
  type Enrichment,
  CATEGORIES,
  NETWORKING_TAGS,
  NETWORKING_FORMATS,
  MUSIC_TAGS,
  MUSIC_FORMATS,
  STAGE_TAGS,
  STAGE_FORMATS,
  SPORT_TAGS,
  SPORT_FORMATS,
  CULTURE_TAGS,
  CULTURE_FORMATS,
} from './schemas';
import type { RawEvent } from '../scrapers/types';

const MODEL = 'deepseek-v4-flash';
const BASE_URL = 'https://api.deepseek.com';

let cached: OpenAI | null = null;

function client(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY in .env.local');
  cached = new OpenAI({ apiKey, baseURL: BASE_URL });
  return cached;
}

const SYSTEM_PROMPT = `You are a multi-domain event classifier for a personal dashboard in London. The user is a tech founder in their late 20s/early 30s.

First, classify the event into ONE of these categories:
- networking: founder/tech events, VC dinners, demo days, hackathons, AI events
- music: gigs, concerts, club nights, DJ sets, festivals, live performances
- stage: theatre, comedy, film screenings, opera, dance, musicals
- sport: football matches, races, tournaments, fixtures
- culture: restaurant openings, exhibitions, museum shows, food markets, pop-ups

Return a JSON object:

{
  "category": "${CATEGORIES.join(' | ')}",
  "appeal_score": integer 0-10,
  "tags": string[],
  "format": string | null,
  "cleaned_description": string | null,
  "facets": object,
  "rationale": string,
  "networking_score": integer | null,
  "founder_density": "high" | "medium" | "low" | "unknown" | null,
  "organizer_type": "vc" | "founder" | "think_tank" | "community" | "company" | "unknown" | null
}

Fields explained:
- appeal_score (0-10): how compelling is this event for a London-based tech founder in their late 20s/early 30s. Be discerning — a 7 means "genuinely worth an evening", a 9 means "don't miss this." Average events should get 3-5.
- tags: 0-6 tags ONLY from the appropriate category list below. Do not mix tags across categories.
- format: from the category's format list, or null if unclear.
- cleaned_description: 1-3 sentence summary. null if no useful description.
- rationale: one sentence explaining the appeal_score.
- networking_score, founder_density, organizer_type: ONLY populate when category='networking'. Omit (set to null) for all other categories.

Per-category tags and formats:

NETWORKING
  Tags: ${NETWORKING_TAGS.join(', ')}
  Formats: ${NETWORKING_FORMATS.join(', ')}
  Facets: {} (empty object, networking doesn't use facets yet)

MUSIC
  Tags: ${MUSIC_TAGS.join(', ')}
  Formats: ${MUSIC_FORMATS.join(', ')}
  Facets: { "artists": string[], "genres": string[], "venue_tier": "intimate" | "mid" | "arena" | null }

STAGE
  Tags: ${STAGE_TAGS.join(', ')}
  Formats: ${STAGE_FORMATS.join(', ')}
  Facets: { "run_start": ISO-date | null, "run_end": ISO-date | null, "writer": string | null, "director": string | null, "cast": string[] }

SPORT
  Tags: ${SPORT_TAGS.join(', ')}
  Formats: ${SPORT_FORMATS.join(', ')}
  Facets: { "teams": string[], "competition": string | null }

CULTURE
  Tags: ${CULTURE_TAGS.join(', ')}
  Formats: ${CULTURE_FORMATS.join(', ')}
  Facets: { "cuisine": string | null, "kind": "restaurant" | "exhibition" | "opening" | "museum" | null }

Rules:
- Pick exactly ONE category. Don't hedge.
- Tags must come EXCLUSIVELY from the chosen category's tag list. Do not mix tags from other categories.
- appeal_score should discriminate: a 7 is meaningfully better than a 4. Use the full 0-10 range.
- networking_score is about "can I have real conversations with people" — a 500-person conference is a 3, a 30-person founder dinner is a 9. Only set this for networking.
- Do not invent tags, formats, or category values outside the above lists.

Return ONLY the JSON object. No prose.`;

export async function enrichEvent(event: RawEvent): Promise<Enrichment> {
  const input = {
    title: event.title,
    description: event.description,
    organizer: event.organizer,
    venue: event.venue_name,
    city: event.venue_city,
    is_virtual: event.is_virtual,
    starts_at: event.starts_at,
    source: event.source,
    url: event.url,
  };

  const msg = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(input, null, 2) },
    ],
  });

  const text = msg.choices[0]?.message?.content ?? '';
  const parsed = extractJson(text);
  return enrichmentSchema.parse(parsed);
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const candidate = fenced?.[1] ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(candidate);
}
