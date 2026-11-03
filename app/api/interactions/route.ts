import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { recomputeInterestEmbedding } from '@/lib/personalize/recompute';

export const dynamic = 'force-dynamic';

type Body = { event_id: string; action: 'save' | 'dismiss' };

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Body>;
  if (!body.event_id || (body.action !== 'save' && body.action !== 'dismiss')) {
    return NextResponse.json({ error: 'event_id and action (save|dismiss) required' }, { status: 400 });
  }
  const { event_id, action } = body as Body;
  const db = supabaseAdmin();

  const { data: existing, error: selectError } = await db
    .from('interactions')
    .select('id')
    .eq('event_id', event_id)
    .eq('action', action)
    .maybeSingle();
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });

  let active: boolean;
  if (existing) {
    // Toggle off.
    const { error } = await db.from('interactions').delete().eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    active = false;
  } else {
    // Clear the opposite signal (star and dismiss are mutually exclusive), then set this one.
    await db.from('interactions').delete().eq('event_id', event_id).in('action', ['save', 'dismiss']);
    const { error } = await db.from('interactions').insert({ event_id, action });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    active = true;
  }

  await recomputeInterestEmbedding();

  return NextResponse.json({ ok: true, active });
}
