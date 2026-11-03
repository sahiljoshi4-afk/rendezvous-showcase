import { NextResponse, type NextRequest } from 'next/server';
import { scrapeLuma, type LumaCity } from '@/lib/scrapers/luma';
import { runPipeline } from '@/lib/scrapers/pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const VALID_CITIES: LumaCity[] = ['london', 'sf', 'nyc'];

export async function GET(request: NextRequest) {
  const cityParam = request.nextUrl.searchParams.get('city') ?? 'london';
  if (!VALID_CITIES.includes(cityParam as LumaCity)) {
    return NextResponse.json(
      { error: `Invalid city. One of: ${VALID_CITIES.join(', ')}` },
      { status: 400 },
    );
  }
  const city = cityParam as LumaCity;
  try {
    const result = await runPipeline(`luma_${city}`, () => scrapeLuma(city));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
