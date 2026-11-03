import { supabaseAdmin } from '@/lib/db/client';
import { parseEmbedding } from '@/lib/db/vector';
import { rankEvents } from '@/lib/personalize/rank';
import { getOrCreateProfile } from '@/lib/db/profile';
import { TasteCard } from './TasteCard';

export const dynamic = 'force-dynamic';

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  venue_name: string | null;
  category: string | null;
  price_amount: number | null;
  appeal_score: number | null;
  networking_score: number | null;
  founder_density: string | null;
  organizer: string | null;
  tags: string[] | null;
  url: string | null;
  embedding: number[] | null;
};

async function loadTastingBatch(): Promise<EventRow[]> {
  try {
    const db = supabaseAdmin();
    const profile = await getOrCreateProfile();

    // Get already-rated event IDs
    const { data: rated } = await db
      .from('interactions')
      .select('event_id')
      .in('action', ['taste_yes', 'taste_no']);
    const ratedIds = new Set((rated ?? []).map((r) => r.event_id));

    // Get diverse events: mix of categories, not yet rated
    const cats = ['music', 'stage', 'networking', 'culture', 'sport'];
    const events: EventRow[] = [];

    for (const cat of cats) {
      const { data } = await db
        .from('events')
        .select('id, title, description, starts_at, venue_name, category, price_amount, appeal_score, networking_score, founder_density, organizer, tags, url, embedding')
        .eq('status', 'active')
        .eq('category', cat)
        .gte('starts_at', new Date().toISOString())
        .order('appeal_score', { ascending: false })
        .limit(10);

      if (data) {
        for (const e of data) {
          if (!ratedIds.has(e.id)) {
            events.push({ ...e, embedding: parseEmbedding(e.embedding) });
          }
        }
      }
    }

    // Rank the unrated events and return top 20
    const ranked = rankEvents(events, profile.interest_embedding);
    return ranked.slice(0, 20);
  } catch (err) {
    console.error('[taste] load failed:', err);
    return [];
  }
}

export default async function TastePage() {
  const events = await loadTastingBatch();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-lg mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Taste Calibration</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Rate {events.length} events to teach Rendezvous what you like.
            <br />
            Be honest — a few strong opinions beat dozens of maybes.
          </p>
        </header>

        {events.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <p className="text-lg">All caught up!</p>
            <p className="text-sm mt-1">No unrated events right now. Come back after the next scrape.</p>
          </div>
        ) : (
          <TasteCard events={events} />
        )}
      </div>
    </div>
  );
}
