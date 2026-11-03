'use client';

import { format, parseISO } from 'date-fns';
import type { FeedEvent } from './EventCard';
import { useEventActions } from '@/lib/hooks/useEventActions';

const CATEGORY_EMOJI: Record<string, string> = {
  networking: '🤝',
  music: '🎵',
  stage: '🎭',
  sport: '⚽',
  culture: '🍽️',
};

export function ListRow({ event, showDate = true }: { event: FeedEvent; showDate?: boolean }) {
  const { starred, dismissed, toggleStar, dismiss } = useEventActions(event.id, event.starred ?? false);
  if (dismissed) return null;

  const when = event.starts_at ? parseISO(event.starts_at) : null;
  const dateStr = when ? format(when, 'EEE d MMM') : null;
  const timeStr = when ? format(when, 'h:mmaaa').toLowerCase() : null;
  const location = event.is_virtual
    ? 'Virtual'
    : [event.venue_city].filter(Boolean).join(' · ');
  const highSignal =
    event.category === 'networking' && (
      event.founder_density === 'high' || (event.networking_score ?? 0) >= 7
    );
  const score = event.appeal_score ?? event.networking_score;
  const catEmoji = event.category ? (CATEGORY_EMOJI[event.category] ?? '') : '';

  return (
    <a
      href={event.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
    >
      <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0 w-32">
        {showDate ? (
          <div className="flex flex-col leading-tight">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{dateStr ?? '—'}</span>
            <span>{timeStr}</span>
          </div>
        ) : (
          <span>{timeStr ?? '—'}</span>
        )}
      </div>

      <div className="min-w-0">
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
          {catEmoji && <span className="mr-1">{catEmoji}</span>}
          {event.title}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
          {[event.organizer, event.format, location].filter(Boolean).join(' · ')}
          {event.tags && event.tags.length > 0 && (
            <span className="ml-2 opacity-70">
              {event.tags.slice(0, 3).join(' · ')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {highSignal && <span aria-label="High founder density">🔥</span>}
        {score !== null && score !== undefined && (
          <span
            className={
              'text-xs font-mono tabular-nums w-5 text-right ' +
              (score >= 7
                ? 'text-orange-600 dark:text-orange-400 font-semibold'
                : 'text-zinc-400 dark:text-zinc-500')
            }
          >
            {score}
          </span>
        )}
        <button
          type="button"
          onClick={toggleStar}
          aria-pressed={starred}
          aria-label={starred ? 'Unstar' : 'Star'}
          className={
            'text-base leading-none px-1.5 py-1 rounded ' +
            (starred ? 'text-amber-500' : 'text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400')
          }
        >
          {starred ? '★' : '☆'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not for me"
          className="text-xs leading-none px-1.5 py-1 rounded text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400"
        >
          ✕
        </button>
      </div>
    </a>
  );
}
