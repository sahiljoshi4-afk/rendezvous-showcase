import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Public routes that don't require auth.
const PUBLIC_PATHS = new Set(['/login', '/auth/callback', '/auth/signout']);
// Cron endpoints authenticate via Bearer CRON_SECRET, not sessions.
const CRON_PATH_PREFIX = '/api/scrape/';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Cron endpoints: allow if Bearer CRON_SECRET matches (Vercel Cron sends this automatically).
  if (pathname.startsWith(CRON_PATH_PREFIX)) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return response; // no secret set = open for local dev
    const auth = request.headers.get('authorization');
    if (auth === `Bearer ${secret}`) return response;
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Public paths pass through.
  if (PUBLIC_PATHS.has(pathname)) return response;

  // Authenticated path — require session + whitelisted email.
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  const allowlist = (process.env.SIGN_IN_ALLOWLIST ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = user.email?.toLowerCase();
  if (allowlist.length > 0 && (!email || !allowlist.includes(email))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('error', 'not_allowed');
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
