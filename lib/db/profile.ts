import { supabaseAdmin } from './client';
import { parseEmbedding } from './vector';

export type Profile = {
  id: string;
  interest_embedding: number[] | null;
};

// Single-user tool — there is exactly one profile row, created on first use.
export async function getOrCreateProfile(): Promise<Profile> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('profile')
    .select('id, interest_embedding')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return { id: data.id, interest_embedding: parseEmbedding(data.interest_embedding) };

  const { data: created, error: insertError } = await db
    .from('profile')
    .insert({})
    .select('id, interest_embedding')
    .single();
  if (insertError) throw new Error(insertError.message);
  return { id: created.id, interest_embedding: parseEmbedding(created.interest_embedding) };
}
