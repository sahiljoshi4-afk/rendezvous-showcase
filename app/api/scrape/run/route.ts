import { NextResponse } from 'next/server';
import { runAllSources } from '@/lib/sources/runner';

// Register V1 adapters on first import
import '@/lib/sources/adapters';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET() {
  try {
    const results = await runAllSources();
    const summary = {
      sources: results.length,
      total_fetched: results.reduce((s, r) => s + r.fetched, 0),
      total_written: results.reduce((s, r) => s + r.written, 0),
      total_errors: results.reduce((s, r) => s + r.errors, 0),
      details: results,
    };
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
