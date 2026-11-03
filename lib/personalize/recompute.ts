import { supabaseAdmin } from '../db/client';
import { getOrCreateProfile } from '../db/profile';
import { upsertPreference } from '../db/preferences';
import { parseEmbedding } from '../db/vector';

const DISMISS_WEIGHT = 0.4;

// Rocchio-style relevance feedback: pull the profile vector toward starred
// events, push it away from dismissed ones. Pure vector math — no LLM/embedding
// API calls needed, since every event already carries its own embedding.
//
// V2: also computes per-category vectors in the `preferences` table,
// so taste doesn't get averaged into mush across domains. The global
// `profile.interest_embedding` still updates as the cross-category fallback.
export async function recomputeInterestEmbedding(): Promise<void> {
  const db = supabaseAdmin();
  const profile = await getOrCreateProfile();

  // --- Global (cross-category) vector ---
  const [starred, dismissed] = await Promise.all([
    getEmbeddings('save'),
    getEmbeddings('dismiss'),
  ]);

  const globalVec = computeRocchio(starred, dismissed);
  await db
    .from('profile')
    .update({
      interest_embedding: globalVec,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  // --- Per-category vectors ---
  const [starredByCat, dismissedByCat] = await Promise.all([
    getEmbeddingsByCategory('save'),
    getEmbeddingsByCategory('dismiss'),
  ]);

  // Collect all categories that appear in either starred or dismissed
  const categories = new Set([
    ...starredByCat.keys(),
    ...dismissedByCat.keys(),
  ]);

  for (const category of categories) {
    const catStarred = starredByCat.get(category) ?? [];
    const catDismissed = dismissedByCat.get(category) ?? [];
    const catVec = computeRocchio(catStarred, catDismissed);
    await upsertPreference(category, catVec, catStarred.length);
  }
}

function computeRocchio(starred: number[][], dismissed: number[][]): number[] | null {
  if (starred.length === 0) return null;

  const starredMean = meanVector(starred);
  const pref =
    dismissed.length > 0
      ? subtract(starredMean, scale(meanVector(dismissed), DISMISS_WEIGHT))
      : starredMean;
  return normalize(pref);
}

// Returns all embeddings for a given action (star/dismiss), unfiltered by category.
async function getEmbeddings(action: 'save' | 'dismiss'): Promise<number[][]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('interactions')
    .select('events(embedding)')
    .eq('action', action);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) =>
      parseEmbedding(
        (row as unknown as { events: { embedding: unknown } | null }).events?.embedding,
      ),
    )
    .filter((e): e is number[] => e !== null && e.length > 0);
}

// Returns embeddings grouped by category for a given action.
async function getEmbeddingsByCategory(
  action: 'save' | 'dismiss',
): Promise<Map<string, number[][]>> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('interactions')
    .select('events(embedding, category)')
    .eq('action', action);
  if (error) throw new Error(error.message);

  const byCategory = new Map<string, number[][]>();
  for (const row of data ?? []) {
    const events = (row as unknown as { events: { embedding: unknown; category: string | null } | null }).events;
    if (!events) continue;
    const embedding = parseEmbedding(events.embedding);
    if (!embedding || embedding.length === 0) continue;
    // ponytail: fallback to 'networking' for pre-V2 rows without category.
    // Remove when all historical events have been backfilled.
    const category = events.category || 'networking';
    const list = byCategory.get(category) ?? [];
    list.push(embedding);
    byCategory.set(category, list);
  }
  return byCategory;
}

function meanVector(vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  return sum.map((s) => s / vectors.length);
}

function subtract(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}

function scale(v: number[], factor: number): number[] {
  return v.map((x) => x * factor);
}

function normalize(v: number[]): number[] {
  const magnitude = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  if (magnitude === 0) return v;
  return v.map((x) => x / magnitude);
}
