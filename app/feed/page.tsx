import { supabaseAdmin } from '@/lib/db/client';
import { getOrCreateProfile } from '@/lib/db/profile';
import { parseEmbedding } from '@/lib/db/vector';
import { rankEvents } from '@/lib/personalize/rank';
import { EventCard, type FeedEvent } from './EventCard';
import { ListRow } from './ListRow';
import { CalendarView } from './CalendarView';
import { ViewToggle, VIEWS, type View } from './ViewToggle';

export const dynamic = 'force-dynamic';

type EventRow = FeedEvent & { embedding: number[] | null };

const CATEGORIES = [
  { key: '', emoji: '🏠', label: 'All' },
  { key: 'music', emoji: '🎵', label: 'Music' },
  { key: 'stage', emoji: '🎭', label: 'Theatre' },
  { key: 'networking', emoji: '🤝', label: 'Networking' },
  { key: 'culture', emoji: '🎨', label: 'Culture' },
  { key: 'sport', emoji: '⚽', label: 'Sport' },
];

async function loadEvents(category?: string): Promise<FeedEvent[]> {
  try {
    const db = supabaseAdmin();
    const profile = await getOrCreateProfile();

    const { data: dismissedRows } = await db
      .from('interactions')
      .select('event_id')
      .eq('action', 'dismiss');
    const dismissedIds = new Set((dismissedRows ?? []).map((r) => r.event_id));

    const { data: starredRows } = await db
      .from('interactions')
      .select('event_id')
      .eq('action', 'save');
    const starredIds = new Set((starredRows ?? []).map((r) => r.event_id));

    let query = db
      .from('events')
      .select(
        'id, source, url, title, description, starts_at, timezone, venue_name, venue_city, is_virtual, organizer, organizer_type, image_url, tags, format, category, appeal_score, networking_score, founder_density, price_amount, embedding',
      )
      .eq('status', 'active')
      .gte('starts_at', new Date().toISOString())
      .limit(150);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = ((data ?? []) as EventRow[])
      .filter((e) => !dismissedIds.has(e.id))
      .map((e) => ({ ...e, embedding: parseEmbedding(e.embedding) }));
    const ranked = rankEvents(rows, profile.interest_embedding);
    return ranked.slice(0, 80).map((e) => ({ ...e, starred: starredIds.has(e.id) }));
  } catch (err) {
    console.error('[feed] load failed:', err);
    return [];
  }
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string }>;
}) {
  const params = await searchParams;
  const view: View = VIEWS.includes(params.view as View)
    ? (params.view as View)
    : 'cards';
  const activeCategory = params.category ?? '';
  const events = await loadEvents(activeCategory || undefined);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Rendezvous
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {events.length} events · London
              </p>
            </div>
            <ViewToggle current={view} />
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key;
              return (
                <a
                  key={cat.key}
                  href={cat.key ? `/feed?category=${cat.key}&view=${view}` : `/feed?view=${view}`}
                  className={`inline-flex items-center gap-1.5 text-[13px] font-medium rounded-full px-3.5 py-1.5 whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {events.length === 0 ? (
          <EmptyState category={activeCategory} />
        ) : view === 'cards' ? (
          <CardGrid events={events} />
        ) : view === 'list' ? (
          <ListPane events={events} />
        ) : (
          <CalendarView events={events} />
        )}
      </main>
    </div>
  );
}

function CardGrid({ events }: { events: FeedEvent[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

function ListPane({ events }: { events: FeedEvent[] }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
      {events.map((e) => (
        <ListRow key={e.id} event={e} />
      ))}
    </div>
  );
}

function EmptyState({ category }: { category?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-10 text-center">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
        No events yet
      </h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
        {category
          ? `No ${category} events found. Try a different category.`
          : 'Populate the DB by running a scrape or wait for the scheduled run.'}
      </p>
    </div>
  );
}
