'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Event = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  venue_name: string | null;
  category: string | null;
  price_amount: number | null;
  appeal_score: number | null;
  organizer: string | null;
  tags: string[] | null;
  url: string | null;
};

const CAT_EMOJI: Record<string, string> = {
  music: '🎵', stage: '🎭', networking: '🤝', sport: '⚽', culture: '🎨',
};

export function TasteCard({ events }: { events: Event[] }) {
  const [index, setIndex] = useState(0);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const event = events[index];
  if (!event || index >= events.length) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl mb-4">🎉</p>
        <p className="text-lg font-medium">Done!</p>
        <p className="text-sm text-zinc-400 mt-1">Your preferences have been updated.</p>
        <button
          onClick={() => router.push('/feed')}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-lg hover:bg-zinc-200 transition-colors"
        >
          View your feed →
        </button>
      </div>
    );
  }

  const catEmoji = event.category ? CAT_EMOJI[event.category] ?? '📌' : '📌';
  const when = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;
  const price = event.price_amount != null && event.price_amount > 0
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(event.price_amount)
    : null;

  async function rate(yes: boolean) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/taste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: event.id, yes, reason: reason.trim() || null }),
      });
      setReason('');
      setIndex((i) => i + 1);
    } catch {
      // keep going even if save fails
    }
    setSubmitting(false);
  }

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'y') rate(true);
    if (e.key === 'ArrowRight' || e.key === 'n') rate(false);
  };

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-400 rounded-full transition-all duration-300"
            style={{ width: `${((index + 1) / events.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-zinc-500 tabular-nums">
          {index + 1}/{events.length}
        </span>
      </div>

      {/* Event card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        {/* Category + price */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            {catEmoji} {event.category}
          </span>
          {price && (
            <span className="text-sm font-semibold text-zinc-300">{price}</span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold leading-snug">{event.title}</h2>

        {/* Meta */}
        <div className="space-y-1 text-sm text-zinc-400">
          {when && <p>📅 {when}</p>}
          {event.venue_name && <p>📍 {event.venue_name}</p>}
          {event.organizer && <p>👤 {event.organizer}</p>}
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-sm text-zinc-500 leading-relaxed line-clamp-3">
            {event.description}
          </p>
        )}

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.tags.slice(0, 5).map((tag) => (
              <span key={tag} className="text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Link */}
        {event.url && (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
          >
            Open event page →
          </a>
        )}
      </div>

      {/* Reason input */}
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why? (optional, e.g. 'love this band' or 'too far')"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
      />

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => rate(false)}
          disabled={submitting}
          className="flex-1 py-4 rounded-xl border border-zinc-800 text-zinc-400 font-medium text-lg hover:border-red-800 hover:text-red-400 hover:bg-red-950/30 transition-all disabled:opacity-50"
        >
          👎 Not for me
        </button>
        <button
          type="button"
          onClick={() => rate(true)}
          disabled={submitting}
          className="flex-1 py-4 rounded-xl bg-zinc-100 text-zinc-900 font-bold text-lg hover:bg-white transition-all disabled:opacity-50"
        >
          👍 I&apos;d go
        </button>
      </div>

      <p className="text-center text-[11px] text-zinc-600">
        ← or → arrow keys to rate · Y/N also works
      </p>
    </div>
  );
}
