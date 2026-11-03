import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import {
  updateMessageWithChoice,
  answerCallback,
} from '@/lib/notify/telegram';
import { recomputeInterestEmbedding } from '@/lib/personalize/recompute';

export const dynamic = 'force-dynamic';

function token(): string {
  return process.env.TELEGRAM_BOT_TOKEN ?? '';
}

function chatId(): string {
  return process.env.TELEGRAM_CHAT_ID ?? '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[telegram webhook]', JSON.stringify(body).slice(0, 200));

    // ---- Callback queries (button taps on event cards) ----
    if (body.callback_query) {
      const { id: callbackId, data, message } = body.callback_query;
      const cid = message?.chat?.id?.toString();
      const messageId = message?.message_id;

      if (!data || !cid || !messageId) {
        return NextResponse.json({ ok: true });
      }

      if (data === 'done') {
        await answerCallback(callbackId);
        return NextResponse.json({ ok: true });
      }

      // star:eventId / dismiss:eventId
      const [action, eventId] = data.split(':');
      if (!eventId || !['star', 'dismiss'].includes(action)) {
        await answerCallback(callbackId);
        return NextResponse.json({ ok: true });
      }

      const db = supabaseAdmin();
      const dbAction = action === 'star' ? 'save' : 'dismiss';

      // Fetch event details for calendar button
      const { data: eventData } = await db
        .from('events')
        .select('title, starts_at, venue_name, url, description')
        .eq('id', eventId)
        .single();

      await db.from('interactions').upsert(
        { event_id: eventId, action: dbAction },
        { onConflict: 'event_id' },
      );

      const choice = action === 'star' ? 'starred' : 'dismissed';
      await updateMessageWithChoice(cid, messageId, choice, eventData ?? undefined);
      await answerCallback(callbackId, choice === 'starred' ? '⭐ Saved — taste updated' : '✕ Hidden — won\'t show again');

      recomputeInterestEmbedding().catch(() => {});
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[telegram webhook]', err);
    return NextResponse.json({ ok: true });
  }
}
