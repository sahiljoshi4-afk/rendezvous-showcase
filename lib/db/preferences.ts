import { supabaseAdmin } from './client';
import { parseEmbedding } from './vector';

export type CategoryPreference = {
  category: string;
  interest_embedding: number[] | null;
  sample_count: number;
};

export async function getPreference(category: string): Promise<CategoryPreference | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('preferences')
    .select('category, interest_embedding, sample_count')
    .eq('category', category)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    category: data.category,
    interest_embedding: parseEmbedding(data.interest_embedding),
    sample_count: data.sample_count,
  };
}

export async function getAllPreferences(): Promise<CategoryPreference[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('preferences')
    .select('category, interest_embedding, sample_count')
    .order('category');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    category: r.category as string,
    interest_embedding: parseEmbedding(r.interest_embedding),
    sample_count: r.sample_count as number,
  }));
}

export async function upsertPreference(
  category: string,
  embedding: number[] | null,
  sampleCount: number,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from('preferences')
    .upsert({
      category,
      interest_embedding: embedding,
      sample_count: sampleCount,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
}
