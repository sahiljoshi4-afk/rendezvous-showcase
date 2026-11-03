import { supabaseAdmin } from '../db/client';
import { runPipeline, type PipelineResult } from '../scrapers/pipeline';
import { getAdapter } from './registry';

export async function runAllSources(): Promise<PipelineResult[]> {
  const db = supabaseAdmin();
  const { data: sources, error } = await db
    .from('sources')
    .select('*')
    .eq('enabled', true);

  if (error) throw new Error(error.message);
  if (!sources || sources.length === 0) return [];

  const results: PipelineResult[] = [];

  for (const source of sources) {
    const config = (source.config ?? {}) as Record<string, unknown>;
    const adapterName = config.adapter as string | undefined;

    if (!adapterName) {
      results.push({
        source: source.id,
        fetched: 0,
        written: 0,
        errors: 1,
        error_samples: [`No adapter configured for source ${source.id}`],
      });
      continue;
    }

    const adapter = getAdapter(adapterName);
    if (!adapter) {
      results.push({
        source: source.id,
        fetched: 0,
        written: 0,
        errors: 1,
        error_samples: [`Unknown adapter: ${adapterName}`],
      });
      continue;
    }

    try {
      const result = await runPipeline(source.id, () => adapter(config));
      results.push(result);
    } catch (err) {
      results.push({
        source: source.id,
        fetched: 0,
        written: 0,
        errors: 1,
        error_samples: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  return results;
}
