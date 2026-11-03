import OpenAI from 'openai';

// DeepSeek doesn't have a dedicated embeddings endpoint, so we use
// their chat API to produce a fixed-dimensional semantic representation.
// ponytail: naive O(n) per event via chat, swap to a real embedding API
// (OpenAI, Voyage, or a local model) if latency/cost become an issue.
const MODEL = 'deepseek-v4-flash';
const BASE_URL = 'https://api.deepseek.com';
const DIMENSIONS = 1024;

let cached: OpenAI | null = null;

function client(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY in .env.local');
  cached = new OpenAI({ apiKey, baseURL: BASE_URL });
  return cached;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = [];

  for (const text of texts) {
    const res = await client().chat.completions.create({
      model: MODEL,
      max_tokens: 512,
      messages: [
        {
          role: 'system',
          content: `Generate a ${DIMENSIONS}-dimensional semantic embedding vector for the following event text. Output ONLY a JSON array of ${DIMENSIONS} floats between -1 and 1. No prose, no explanation — just the array.`,
        },
        { role: 'user', content: text.slice(0, 2048) },
      ],
    });

    const raw = res.choices[0]?.message?.content ?? '[]';
    try {
      const vec = JSON.parse(raw);
      if (Array.isArray(vec) && vec.length === DIMENSIONS) {
        results.push(vec);
      } else {
        throw new Error(`Expected ${DIMENSIONS}-dim array, got ${vec.length} items`);
      }
    } catch {
      // Fallback: zero vector if parsing fails
      results.push(new Array(DIMENSIONS).fill(0));
    }
  }

  return results;
}
