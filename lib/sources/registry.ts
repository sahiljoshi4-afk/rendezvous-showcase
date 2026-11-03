import type { RawEvent } from '../scrapers/types';

// Each scraper adapter is a function that returns RawEvent[].
// The config from the sources row is passed through — city params,
// URLs, etc. live in the JSONB config column.
export type ScraperFn = (config: Record<string, unknown>) => Promise<RawEvent[]>;

const adapters = new Map<string, ScraperFn>();

export function registerAdapter(name: string, fn: ScraperFn): void {
  adapters.set(name, fn);
}

export function getAdapter(name: string): ScraperFn | undefined {
  return adapters.get(name);
}
