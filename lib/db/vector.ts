// PostgREST returns pgvector columns as their text representation ("[0.1,0.2,...]"),
// not a native JSON array — every read of a `vector` column needs this.
export function parseEmbedding(raw: unknown): number[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}
