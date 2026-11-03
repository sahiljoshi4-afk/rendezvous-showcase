import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { recomputeInterestEmbedding } from '@/lib/personalize/recompute';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { event_id, yes, reason } = await req.json();
    if (!event_id || typeof yes !== 'boolean') {
      return NextResponse.json({ error: 'Missing event_id or yes' }, { status: 400 });
    }

    const db = supabaseAdmin();

    // Record the interaction
    const action = yes ? 'save' : 'dismiss';
    const { error } = await db.from('interactions').upsert(
      {
        event_id,
        action,
        reason: reason || null,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'event_id', ignoreDuplicates: false },
    );

    if (error) {
      // If the table doesn't have a unique constraint on event_id, try insert
      const { error: insertErr } = await db.from('interactions').insert({
        event_id,
        action,
        reason: reason || null,
      });
      if (insertErr) throw new Error(insertErr.message);
    }

    // Recompute preference vectors after each rating
    try {
      await recomputeInterestEmbedding();
    } catch {
      // Preference recompute is best-effort — don't block the rating
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
