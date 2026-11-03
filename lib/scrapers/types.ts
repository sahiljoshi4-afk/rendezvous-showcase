export type RawEvent = {
  source: string;
  source_id: string;
  url: string | null;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  venue_name: string | null;
  venue_city: string | null;
  is_virtual: boolean;
  price_currency: string | null;
  price_amount: number | null;
  organizer: string | null;
  image_url: string | null;
  raw_payload: unknown;
};

export type EnrichedEvent = RawEvent & {
  // V2 multi-domain
  category: string;
  appeal_score: number | null;
  facets: Record<string, unknown>;
  // V1 networking — kept for backward compatibility, null for non-networking
  tags: string[];
  format: string | null;
  networking_score: number | null;
  founder_density: 'high' | 'medium' | 'low' | 'unknown' | null;
  organizer_type:
    | 'vc'
    | 'founder'
    | 'think_tank'
    | 'community'
    | 'company'
    | 'unknown'
    | null;
  embedding: number[] | null;
};
