import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { getOrCreateProfile } from '@/lib/db/profile';
import { parseEmbedding } from '@/lib/db/vector';
import { rankEvents } from '@/lib/personalize/rank';
import { sendEvent } from '@/lib/notify/telegram';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = supabaseAdmin();
    const profile = await getOrCreateProfile();

    // Get dismissed IDs
    const { data: dismissedRows } = await db
      .from('interactions')
      .select('event_id')
      .eq('action', 'dismiss');
    const dismissedIds = new Set((dismissedRows ?? []).map((r) => r.event_id));

    // Get already-notified IDs
    const { data: notifiedRows } = await db
      .from('events')
      .select('id')
      .not('notified_at', 'is', null);
    const notifiedIds = new Set((notifiedRows ?? []).map((r) => r.id));

    // Get top events
    const { data } = await db
      .from('events')
      .select('*')
      .eq('status', 'active')
      .gte('starts_at', new Date().toISOString())
      .order('appeal_score', { ascending: false })
      .limit(50);

    const candidates = (data ?? [])
      .filter((e) => !dismissedIds.has(e.id) && !notifiedIds.has(e.id))
      .map((e) => ({ ...e, embedding: parseEmbedding(e.embedding) }));

    const ranked = rankEvents(candidates, profile.interest_embedding);
    const top = ranked.slice(0, 3);

    const sent: { title: string; messageId: number }[] = [];
    for (const event of top) {
      try {
        const result = await sendEvent({
          id: event.id,
          title: event.title,
          url: event.url,
          starts_at: event.starts_at,
          venue_name: event.venue_name,
          category: event.category,
          price_amount: event.price_amount,
          description: event.description,
        });
        sent.push({ title: event.title, messageId: result.messageId });

        // Mark as notified
        await db.from('events').update({ notified_at: new Date().toISOString() }).eq('id', event.id);
      } catch (err) {
        console.error(`[telegram send] failed: ${event.title}`, err);
      }
    }

    return NextResponse.json({ sent: sent.length, events: sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
