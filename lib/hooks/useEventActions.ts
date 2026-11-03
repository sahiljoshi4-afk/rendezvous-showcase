'use client';

import { useState, type MouseEvent } from 'react';

export function useEventActions(eventId: string, initialStarred: boolean) {
  const [starred, setStarred] = useState(initialStarred);
  const [dismissed, setDismissed] = useState(false);

  async function post(action: 'save' | 'dismiss') {
    try {
      await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, action }),
      });
    } catch (err) {
      console.error('Failed to record interaction', err);
    }
  }

  function toggleStar(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setStarred((s) => !s);
    void post('save');
  }

  function dismiss(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(true);
    void post('dismiss');
  }

  return { starred, dismissed, toggleStar, dismiss };
}
