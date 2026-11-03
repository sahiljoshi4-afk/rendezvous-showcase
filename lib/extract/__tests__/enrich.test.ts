import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must be set before the module loads — client() checks it eagerly
process.env.DEEPSEEK_API_KEY = 'test-key';

const mockCreate = vi.fn();

vi.mock('openai', () => {
  function MockOpenAI(this: any) {
    this.chat = { completions: { create: mockCreate } };
  }
  return { default: MockOpenAI };
});

import { enrichEvent } from '../claude';
import type { RawEvent } from '../../scrapers/types';

const BASE_EVENT: RawEvent = {
  source: 'test',
  source_id: 'test-1',
  url: 'https://example.com',
  title: '',
  description: null,
  starts_at: '2026-08-15T19:00:00Z',
  ends_at: null,
  timezone: 'Europe/London',
  venue_name: null,
  venue_city: 'London',
  is_virtual: false,
  price_currency: null,
  price_amount: null,
  organizer: null,
  image_url: null,
  raw_payload: {},
};

beforeEach(() => {
  mockCreate.mockReset();
});

describe('enrichEvent — multi-domain', () => {
  it('classifies a networking event (founder dinner)', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            category: 'networking',
            appeal_score: 8,
            tags: ['founders-only', 'dinners', 'ai-startups'],
            format: 'dinner',
            cleaned_description: 'An intimate dinner for AI founders in London, hosted by a VC firm.',
            facets: {},
            rationale: 'Small, high-signal founder dinner — strong networking potential.',
            networking_score: 9,
            founder_density: 'high',
            organizer_type: 'vc',
          }),
        },
      }],
    });

    const result = await enrichEvent({
      ...BASE_EVENT,
      title: 'AI Founders Dinner with a16z',
      description: 'Intimate dinner for 30 AI founders. Invite-only.',
      organizer: 'a16z',
    });

    expect(result.category).toBe('networking');
    expect(result.appeal_score).toBe(8);
    expect(result.tags).toContain('founders-only');
    expect(result.format).toBe('dinner');
    expect(result.networking_score).toBe(9);
    expect(result.founder_density).toBe('high');
    expect(result.organizer_type).toBe('vc');
    expect(result.facets).toEqual({});
  });

  it('classifies a music event (gig)', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            category: 'music',
            appeal_score: 7,
            tags: ['live-music', 'electronic', 'underground'],
            format: 'gig',
            cleaned_description: 'Four Tet plays a 3-hour set at Village Underground, an intimate Shoreditch venue.',
            facets: {
              artists: ['Four Tet'],
              genres: ['electronic'],
              venue_tier: 'intimate',
            },
            rationale: 'Top-tier electronic artist in a small venue — a genuinely special night.',
            networking_score: null,
            founder_density: null,
            organizer_type: null,
          }),
        },
      }],
    });

    const result = await enrichEvent({
      ...BASE_EVENT,
      title: 'Four Tet at Village Underground',
      description: 'Electronic pioneer Four Tet plays an extended set.',
      venue_name: 'Village Underground',
      organizer: 'Village Underground',
    });

    expect(result.category).toBe('music');
    expect(result.appeal_score).toBe(7);
    expect(result.tags).toContain('electronic');
    expect(result.format).toBe('gig');
    expect(result.networking_score).toBeNull();
    expect(result.founder_density).toBeNull();
    expect(result.facets).toEqual({
      artists: ['Four Tet'],
      genres: ['electronic'],
      venue_tier: 'intimate',
    });
  });

  it('classifies a stage event (theatre)', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            category: 'stage',
            appeal_score: 6,
            tags: ['theatre', 'west-end'],
            format: 'play',
            cleaned_description: 'A bold new staging of Hamlet directed by Robert Icke at the Almeida.',
            facets: {
              run_start: '2026-08-10',
              run_end: '2026-10-15',
              writer: 'William Shakespeare',
              director: 'Robert Icke',
              cast: ['Andrew Scott'],
            },
            rationale: 'Critically acclaimed director and a strong lead — worth the evening.',
          }),
        },
      }],
    });

    const result = await enrichEvent({
      ...BASE_EVENT,
      title: 'Hamlet — Almeida Theatre',
      description: 'Robert Icke directs Andrew Scott in a bold new staging of Shakespeare\'s Hamlet.',
      venue_name: 'Almeida Theatre',
      organizer: 'Almeida Theatre',
    });

    expect(result.category).toBe('stage');
    expect(result.tags).toContain('theatre');
    expect(result.format).toBe('play');
    expect(result.facets).toHaveProperty('director', 'Robert Icke');
    expect(result.facets).toHaveProperty('cast');
    expect((result.facets as any).cast).toContain('Andrew Scott');
  });

  it('classifies a sport event (football fixture)', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            category: 'sport',
            appeal_score: 5,
            tags: ['football'],
            format: 'match',
            cleaned_description: 'Arsenal host Chelsea in a Premier League London derby at the Emirates.',
            facets: {
              teams: ['Arsenal', 'Chelsea'],
              competition: 'Premier League',
            },
            rationale: 'Premier League London derby — big if you follow football, niche otherwise.',
          }),
        },
      }],
    });

    const result = await enrichEvent({
      ...BASE_EVENT,
      title: 'Arsenal vs Chelsea',
      description: 'Premier League: Arsenal host Chelsea at the Emirates Stadium.',
      venue_name: 'Emirates Stadium',
    });

    expect(result.category).toBe('sport');
    expect(result.tags).toContain('football');
    expect(result.format).toBe('match');
    expect(result.facets).toEqual({
      teams: ['Arsenal', 'Chelsea'],
      competition: 'Premier League',
    });
  });

  it('classifies a culture event (restaurant opening)', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            category: 'culture',
            appeal_score: 4,
            tags: ['restaurant', 'opening', 'tasting-menu'],
            format: 'opening',
            cleaned_description: 'A new omakase counter from an ex-Nobu chef, opening in Shoreditch next month.',
            facets: {
              cuisine: 'Japanese',
              kind: 'restaurant',
            },
            rationale: 'Interesting concept but unproven — worth a try once reviews are in.',
          }),
        },
      }],
    });

    const result = await enrichEvent({
      ...BASE_EVENT,
      title: 'Sushi Kanesaka opens in Shoreditch',
      description: 'New 12-seat omakase counter from ex-Nobu chef Hideki Kanesaka.',
      venue_name: 'Shoreditch',
    });

    expect(result.category).toBe('culture');
    expect(result.tags).toContain('restaurant');
    expect(result.format).toBe('opening');
    expect(result.facets).toEqual({
      cuisine: 'Japanese',
      kind: 'restaurant',
    });
  });
});
