import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { recomputeInterestEmbedding } from '@/lib/personalize/recompute';

export const dynamic = 'force-dynamic';

// POST — record post-attendance feedback
// { event_id, rating (1-5), feedback_text?, attended? }
export async function POST(req: NextRequest) {
  try {
    const { event_id, rating, feedback_text, attended } = await req.json();
    if (!event_id || typeof rating !== 'number') {
      return NextResponse.json({ error: 'event_id and rating required' }, { status: 400 });
    }

    const db = supabaseAdmin();

    const { error } = await db.from('interactions').upsert(
      {
        event_id,
        action: attended ? 'save' : 'dismiss',
        rating,
        feedback_text: feedback_text || null,
        attended: attended ?? true,
      },
      { onConflict: 'event_id' },
    );

    if (error) throw new Error(error.message);

    // Recompute preferences with the new signal
    recomputeInterestEmbedding().catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET — events you've attended (for retrospective writing)
export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('interactions')
      .select('event_id, rating, feedback_text, attended, created_at')
      .eq('attended', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Enrich with event details
    const enriched = [];
    for (const row of data ?? []) {
      const { data: event } = await db
        .from('events')
        .select('title, category, venue_name, starts_at')
        .eq('id', row.event_id)
        .single();
      enriched.push({ ...row, event });
    }

    return NextResponse.json(enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
