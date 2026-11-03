import Link from 'next/link';

export type View = 'cards' | 'list' | 'calendar';

export const VIEWS: View[] = ['cards', 'list', 'calendar'];

const items: { id: View; label: string; icon: string }[] = [
  { id: 'cards', label: 'Cards', icon: '▤' },
  { id: 'list', label: 'List', icon: '≡' },
  { id: 'calendar', label: 'Calendar', icon: '☷' },
];

export function ViewToggle({ current }: { current: View }) {
  return (
    <div className="inline-flex items-center gap-0.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
      {items.map((v) => {
        const active = v.id === current;
        return (
          <Link
            key={v.id}
            href={`/feed?view=${v.id}`}
            className={
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs sm:text-sm rounded-md transition-colors ' +
              (active
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm font-medium'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100')
            }
          >
            <span aria-hidden>{v.icon}</span>
            <span>{v.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
