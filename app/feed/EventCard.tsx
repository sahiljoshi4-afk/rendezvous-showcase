'use client';

import { format, isThisWeek, isThisYear, parseISO } from 'date-fns';
import { useEventActions } from '@/lib/hooks/useEventActions';

export type FeedEvent = {
  id: string;
  source: string;
  url: string | null;
  title: string;
  description: string | null;
  starts_at: string | null;
  timezone: string | null;
  venue_name: string | null;
  venue_city: string | null;
  is_virtual: boolean;
  organizer: string | null;
  organizer_type: string | null;
  image_url: string | null;
  tags: string[] | null;
  format: string | null;
  category: string | null;
  appeal_score: number | null;
  networking_score: number | null;
  founder_density: 'high' | 'medium' | 'low' | 'unknown' | null;
  price_amount: number | null;
  starred?: boolean;
};

const SOURCE_LABELS: Record<string, string> = {
  luma_london: 'Luma',
  eventbrite_london: 'Eventbrite',
  cerebral_valley_london: 'Cerebral Valley',
};

const CATEGORY_STYLE: Record<string, { emoji: string; label: string; accent: string; bg: string }> = {
  networking: { emoji: '🤝', label: 'Networking', accent: 'border-l-amber-400 dark:border-l-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-950/20' },
  music:      { emoji: '🎵', label: 'Music',      accent: 'border-l-purple-400 dark:border-l-purple-500', bg: 'bg-purple-50/50 dark:bg-purple-950/20' },
  stage:      { emoji: '🎭', label: 'Theatre',    accent: 'border-l-rose-400 dark:border-l-rose-500', bg: 'bg-rose-50/50 dark:bg-rose-950/20' },
  sport:      { emoji: '⚽', label: 'Sport',      accent: 'border-l-green-400 dark:border-l-green-500', bg: 'bg-green-50/50 dark:bg-green-950/20' },
  culture:    { emoji: '🎨', label: 'Culture',    accent: 'border-l-teal-400 dark:border-l-teal-500', bg: 'bg-teal-50/50 dark:bg-teal-950/20' },
};

export function EventCard({ event }: { event: FeedEvent }) {
  const { starred, dismissed, toggleStar, dismiss } = useEventActions(event.id, event.starred ?? false);
  if (dismissed) return null;

  const cat = event.category ? (CATEGORY_STYLE[event.category] ?? CATEGORY_STYLE.culture) : CATEGORY_STYLE.culture;
  const when = formatDate(event.starts_at);
  const time = formatTime(event.starts_at);
  const where = event.is_virtual
    ? 'Virtual'
    : [event.venue_name, event.venue_city].filter(Boolean).join(' · ');
  const sourceLabel = SOURCE_LABELS[event.source] ?? event.source?.replace(/_/g, ' ');
  const price = event.price_amount != null && event.price_amount > 0
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(event.price_amount)
    : null;

  return (
    <div className={`group relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden transition-all hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700 border-l-4 ${cat.accent}`}>
      {/* Clickable main area */}
      <a
        href={event.url ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4"
      >
        {/* Top row: category + source */}
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{sourceLabel}</span>
          {price && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">{price}</span>
            </>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50 line-clamp-2 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
          {event.title}
        </h3>

        {/* Meta row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500 dark:text-zinc-400">
          {when && (
            <span className="inline-flex items-center gap-1">
              <span className="text-zinc-400 dark:text-zinc-500">📅</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{when}</span>
              {time && <span className="text-zinc-400 dark:text-zinc-500">· {time}</span>}
            </span>
          )}
          {where && (
            <span className="inline-flex items-center gap-1">
              <span className="text-zinc-400 dark:text-zinc-500">📍</span>
              <span>{where}</span>
            </span>
          )}
        </div>

        {/* Description excerpt */}
        {event.description && (
          <p className="mt-2 text-[13px] text-zinc-400 dark:text-zinc-500 line-clamp-1 leading-relaxed">
            {event.description}
          </p>
        )}
      </a>

      {/* Action bar */}
      <div className="flex items-center gap-1 px-4 pb-3 pt-1 border-t border-zinc-100 dark:border-zinc-800/50">
        <button
          type="button"
          onClick={toggleStar}
          aria-pressed={starred}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-medium rounded-lg px-3 py-1.5 transition-all ${
            starred
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
              : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <span className={starred ? 'text-amber-500' : ''}>{starred ? '★' : '☆'}</span>
          <span>{starred ? 'Saved' : 'Save'}</span>
        </button>

        <button
          type="button"
          onClick={() => window.open(googleCalendarUrl(event), '_blank', 'noopener,noreferrer')}
          className="inline-flex items-center justify-center text-[13px] rounded-lg px-2.5 py-1.5 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
          title="Add to Google Calendar"
        >
          📅
        </button>

        <button
          type="button"
          onClick={dismiss}
          className="inline-flex items-center justify-center text-[13px] rounded-lg px-2.5 py-1.5 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all"
          title="Not interested"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = parseISO(iso);
  if (isThisWeek(d)) return format(d, 'EEEE');
  if (isThisYear(d)) return format(d, 'EEE d MMM');
  return format(d, 'EEE d MMM yyyy');
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  return format(parseISO(iso), 'h:mmaaa').toLowerCase();
}

function googleCalendarUrl(event: FeedEvent): string {
  const title = encodeURIComponent(event.title);
  const details = encodeURIComponent(
    [event.description, event.url, event.organizer ? `Organizer: ${event.organizer}` : null]
      .filter(Boolean).join('\n\n')
  );
  const location = encodeURIComponent(
    [event.venue_name, event.venue_city].filter(Boolean).join(', ')
  );

  let dates = '';
  if (event.starts_at) {
    const start = event.starts_at.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const startDate = new Date(event.starts_at);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const end = endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    dates = `${start}/${end}`;
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}&sf=true&output=xml`;
}
