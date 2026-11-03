// Side-effect file — registers all scraper adapters on import.
// Import this once (e.g. in the scrape/run route) to wire up the registry.

import { registerAdapter } from './registry';
import { scrapeLuma } from '../scrapers/luma';
import { scrapeEventbrite } from '../scrapers/eventbrite';
import { scrapeCerebralValley } from '../scrapers/cerebralvalley';

registerAdapter('luma', async (config) => {
  const city = (config.city as string) ?? 'london';
  return scrapeLuma(city as 'london' | 'sf' | 'nyc');
});

registerAdapter('eventbrite', async (config) => {
  const city = (config.city as string) ?? 'london';
  return scrapeEventbrite(city as 'london' | 'sf' | 'nyc');
});

registerAdapter('cerebralvalley', async (config) => {
  const city = (config.city as string) ?? 'london';
  return scrapeCerebralValley(city as 'london' | 'sf' | 'nyc');
});

// Generic ICS mode — any source with mode='ics' and a feed URL
import { scrapeICS } from '../scrapers/modes/ics';
registerAdapter('ics', scrapeICS);

// Generic RSS mode — any source with mode='rss' and a feed URL
import { scrapeRSS } from '../scrapers/modes/rss';
registerAdapter('rss', scrapeRSS);

// Generic URL mode — any source with mode='url' and a page URL
import { scrapeURL } from '../scrapers/modes/url';
registerAdapter('url', scrapeURL);
