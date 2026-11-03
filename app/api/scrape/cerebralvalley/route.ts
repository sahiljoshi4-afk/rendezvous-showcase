import { NextResponse, type NextRequest } from 'next/server';
import { scrapeCerebralValley, type CVCity } from '@/lib/scrapers/cerebralvalley';
import { runPipeline } from '@/lib/scrapers/pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const VALID_CITIES: CVCity[] = ['london', 'sf', 'nyc'];

export async function GET(request: NextRequest) {
  const cityParam = request.nextUrl.searchParams.get('city') ?? 'london';
  if (!VALID_CITIES.includes(cityParam as CVCity)) {
    return NextResponse.json(
      { error: `Invalid city. One of: ${VALID_CITIES.join(', ')}` },
      { status: 400 },
    );
  }
  const city = cityParam as CVCity;
  try {
    const result = await runPipeline(`cerebral_valley_${city}`, () => scrapeCerebralValley(city));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
