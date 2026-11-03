// Cron endpoint — Vercel calls this twice a day.
// Pushes top events to Telegram from already-scraped events.
// Scraping is too slow for Vercel free tier — trigger manually via
// GET /api/scrape/run or Telegram "check sources".

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { getOrCreateProfile } from '@/lib/db/profile';
import { parseEmbedding } from '@/lib/db/vector';
import { rankEvents } from '@/lib/personalize/rank';
import { sendEvent } from '@/lib/notify/telegram';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = new Date();
  const log: string[] = [];

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ ok: false, error: 'Missing Telegram config' });
  }

  let pushed = 0;
  try {
    const db = supabaseAdmin();
    const profile = await getOrCreateProfile();

    // Get dismissed
    const { data: dismissedRows } = await db
      .from('interactions')
      .select('event_id')
      .eq('action', 'dismiss');
    const dismissedIds = new Set((dismissedRows ?? []).map((r) => r.event_id));

    // Get already-notified
    const { data: notifiedRows } = await db
      .from('events')
      .select('id')
      .not('notified_at', 'is', null);
    const notifiedIds = new Set((notifiedRows ?? []).map((r) => r.id));

    // Get candidates: new, not dismissed, not already sent
    const { data: candidates } = await db
      .from('events')
      .select('*')
      .eq('status', 'active')
      .gte('starts_at', new Date().toISOString())
      .not('appeal_score', 'is', null)
      .order('appeal_score', { ascending: false })
      .limit(30);

    const eligible = (candidates ?? [])
      .filter((e) => !dismissedIds.has(e.id) && !notifiedIds.has(e.id))
      .map((e) => ({ ...e, embedding: parseEmbedding(e.embedding) }));

    const ranked = rankEvents(eligible, profile.interest_embedding);
    const top = ranked.slice(0, 3);

    for (const event of top) {
      try {
        await sendEvent({
          id: event.id,
          title: event.title,
          url: event.url,
          starts_at: event.starts_at,
          venue_name: event.venue_name,
          category: event.category,
          price_amount: event.price_amount,
          description: event.description,
        });

        await db.from('events').update({ notified_at: new Date().toISOString() }).eq('id', event.id);
        pushed++;
      } catch (err) {
        log.push(`Push error for "${event.title}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    log.push(`Pushed: ${pushed} events to Telegram`);
  } catch (err) {
    log.push(`Push error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const duration = (Date.now() - started.getTime()) / 1000;

  return NextResponse.json({
    ok: true,
    duration_seconds: Math.round(duration),
    pushed,
    log,
  });
}
