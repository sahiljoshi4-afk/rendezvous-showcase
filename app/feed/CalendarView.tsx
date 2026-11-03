import {
  differenceInCalendarDays,
  format,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { FeedEvent } from './EventCard';
import { ListRow } from './ListRow';

export function CalendarView({ events }: { events: FeedEvent[] }) {
  const groups = groupByDay(events);
  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map(([label, sublabel, dayEvents]) => (
        <section key={label + sublabel}>
          <div className="flex items-baseline gap-2 mb-2 px-1">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {label}
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{sublabel}</span>
            <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
              {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
            </span>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
            {dayEvents.map((e) => (
              <ListRow key={e.id} event={e} showDate={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function groupByDay(
  events: FeedEvent[],
): Array<[string, string, FeedEvent[]]> {
  const map = new Map<string, FeedEvent[]>();
  for (const e of events) {
    if (!e.starts_at) continue;
    const d = parseISO(e.starts_at);
    const key = format(startOfDay(d), 'yyyy-MM-dd');
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([key, evts]) => {
    const d = parseISO(key);
    return [dayLabel(d), format(d, 'EEEE, d MMM'), evts] as [
      string,
      string,
      FeedEvent[],
    ];
  });
}

function dayLabel(d: Date): string {
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  const diff = differenceInCalendarDays(d, new Date());
  if (diff > 0 && diff <= 6) return `In ${diff} days`;
  if (diff > 6 && diff <= 13) return 'Next week';
  if (diff > 13 && diff <= 20) return 'In 2 weeks';
  if (diff > 20 && diff <= 27) return 'In 3 weeks';
  if (diff > 27) return 'Later';
  return format(d, 'EEEE');
}
