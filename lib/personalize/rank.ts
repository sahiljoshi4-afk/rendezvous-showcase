export type RankableEvent = {
  id: string;
  starts_at: string | null;
  category: string | null;
  appeal_score: number | null;
  networking_score: number | null;
  founder_density: string | null;
  price_amount: number | null;
  embedding: number[] | null;
};

// Small event volume (a few hundred rows) — scoring in the app layer is simplest
// thing that works. Revisit with a Postgres RPC if that stops being true.
export function rankEvents<T extends RankableEvent>(
  events: T[],
  profileEmbedding: number[] | null,
): T[] {
  if (!profileEmbedding) {
    return [...events].sort((a, b) => fallbackScore(b) - fallbackScore(a));
  }

  return [...events]
    .map((event) => ({ event, score: scoreEvent(event, profileEmbedding) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.event);
}

// Fallback when no taste vector exists yet — sort by appeal_score for
// non-networking, networking_score for networking, recency as tiebreaker.
function fallbackScore(event: RankableEvent): number {
  const base =
    event.category === 'networking'
      ? (event.networking_score ?? event.appeal_score ?? -1)
      : (event.appeal_score ?? event.networking_score ?? -1);
  // Minor recency bonus so upcoming items float above distant ones at equal score
  const recency = event.starts_at
    ? 1.0 - Math.max(0, (new Date(event.starts_at).getTime() - Date.now()) / (90 * 86_400_000))
    : 0;
  return base + recency * 0.01;
}

function scoreEvent(event: RankableEvent, profileEmbedding: number[]): number {
  const similarity = event.embedding
    ? cosineSimilarity(event.embedding, profileEmbedding)
    : 0;
  const recency = recencyBoost(event.starts_at);
  // founder_density boost only applies to networking events (V2)
  const founderBoost =
    event.category === 'networking' && event.founder_density === 'high' ? 1.15 : 1.0;
  const priceBoost =
    event.price_amount === 0 || event.price_amount === null ? 1.1 : 1.0;
  return similarity * recency * founderBoost * priceBoost;
}

function recencyBoost(startsAt: string | null): number {
  if (!startsAt) return 1.0;
  const daysUntil = (new Date(startsAt).getTime() - Date.now()) / 86_400_000;
  if (daysUntil <= 7) return 1.2;
  if (daysUntil <= 14) return 1.0;
  return 0.85;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
