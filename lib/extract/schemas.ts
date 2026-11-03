import { z } from 'zod';

// ============================================================
// Categories
// ============================================================
export const CATEGORIES = [
  'networking',
  'music',
  'stage',
  'sport',
  'culture',
] as const;
export type Category = (typeof CATEGORIES)[number];

// ============================================================
// Per-category tags
// ============================================================
export const NETWORKING_TAGS = [
  'ai-startups',
  'ai-infra',
  'applied-ai',
  'deep-tech',
  'founders-only',
  'founder-networking',
  'venture-capital',
  'hacker-events',
  'demo-days',
  'dinners',
  'climate-tech',
  'bio',
  'fintech',
  'defense-tech',
  'tech-policy',
  'founder-podcasts',
  'hardware',
  'robotics',
  'hackathons',
] as const;

export const MUSIC_TAGS = [
  'live-music',
  'dj-set',
  'club-night',
  'festival',
  'electronic',
  'indie',
  'jazz',
  'hip-hop',
  'rock',
  'pop',
  'classical',
  'underground',
  'open-air',
  'album-launch',
] as const;

export const STAGE_TAGS = [
  'theatre',
  'comedy',
  'musical',
  'film',
  'opera',
  'dance',
  'experimental',
  'west-end',
  'fringe',
  'improv',
  'stand-up',
  'screening',
] as const;

export const SPORT_TAGS = [
  'football',
  'rugby',
  'cricket',
  'tennis',
  'boxing',
  'formula-1',
  'athletics',
  'horse-racing',
] as const;

export const CULTURE_TAGS = [
  'restaurant',
  'exhibition',
  'opening',
  'museum',
  'gallery',
  'food-market',
  'pop-up',
  'tasting-menu',
  'installation',
  'talk',
] as const;

export const ALL_TAGS = [
  ...NETWORKING_TAGS,
  ...MUSIC_TAGS,
  ...STAGE_TAGS,
  ...SPORT_TAGS,
  ...CULTURE_TAGS,
] as const;

// ============================================================
// Per-category formats
// ============================================================
export const NETWORKING_FORMATS = [
  'dinner',
  'drinks',
  'hackathon',
  'demo_day',
  'panel',
  'talk',
  'workshop',
  'networking',
  'conference',
] as const;

export const MUSIC_FORMATS = [
  'concert',
  'club-night',
  'festival',
  'dj-set',
  'gig',
  'open-mic',
  'album-launch',
  'listening-party',
] as const;

export const STAGE_FORMATS = [
  'play',
  'musical',
  'comedy-show',
  'film-screening',
  'opera',
  'ballet',
  'dance',
  'improv',
  'stand-up',
] as const;

export const SPORT_FORMATS = [
  'match',
  'race',
  'tournament',
  'fixture',
  'grand-prix',
] as const;

export const CULTURE_FORMATS = [
  'exhibition',
  'opening',
  'pop-up',
  'tasting',
  'talk',
  'fair',
  'festival',
] as const;

// ============================================================
// Networking-specific (kept for backward compatibility)
// ============================================================
export const FOUNDER_DENSITY = ['high', 'medium', 'low', 'unknown'] as const;
export const ORGANIZER_TYPE = [
  'vc',
  'founder',
  'think_tank',
  'community',
  'company',
  'unknown',
] as const;

// Re-export for backward compatibility with existing imports
export const TAXONOMY = NETWORKING_TAGS;
export const FORMATS = NETWORKING_FORMATS;

// ============================================================
// Schema
// ============================================================
export const enrichmentSchema = z.object({
  category: z.enum(CATEGORIES),
  appeal_score: z.number().int().min(0).max(10),
  tags: z.array(z.string()).max(8),
  format: z.string().nullable(),
  cleaned_description: z.string().max(800).nullable(),
  facets: z.record(z.string(), z.unknown()).default({} as Record<string, unknown>),
  rationale: z.string().max(500),
  // networking-specific — only populated when category='networking'
  networking_score: z.number().int().min(0).max(10).nullable().optional(),
  founder_density: z.enum(FOUNDER_DENSITY).nullable().optional(),
  organizer_type: z.enum(ORGANIZER_TYPE).nullable().optional(),
});

export type Enrichment = z.infer<typeof enrichmentSchema>;
