# Rendezvous

A personal event-discovery agent for London. It scrapes event sources, uses an LLM to
turn messy listings into structured records, scores them against a taste profile that
learns from your reactions, and pushes the genuine hits to Telegram.

This is a trimmed showcase of the core loop, not the full private build.

## What it does

1. **Scrape** – Luma, Eventbrite, Cerebral Valley, plus generic RSS, ICS and URL sources (`lib/scrapers`, `lib/sources`). Sources are rows in Postgres; each maps to an adapter.
2. **Enrich** – an LLM extracts category (networking, music, stage, sport, culture), venue, price, an appeal score and a one-line "why" (`lib/extract`).
3. **Embed & rank** – every event gets an embedding. Your starred/dismissed events are folded into a per-user preference vector (Rocchio-style), and events are ranked by cosine similarity with a score fallback for cold start (`lib/personalize`).
4. **Push** – a twice-daily cron sends the top unseen events to Telegram with ⭐ / ✕ buttons; taps feed straight back into the preference vector (`app/api/cron`, `app/api/telegram/webhook`).
5. **Browse** – `/feed` (list and calendar views) and `/taste` for rating events to calibrate.

## Stack

Next.js 16 · Supabase (Postgres + pgvector) · Vercel cron · Telegram Bot API · DeepSeek (swappable).

## Run it

```bash
cp .env.example .env.local   # fill in keys
# apply supabase/migrations/*.sql in order
npm install
npm run dev
```

Trigger a scrape with `GET /api/scrape/run`, then `GET /api/cron` to push to Telegram.
Point the Telegram webhook at `/api/telegram/webhook`.

## Left out of this version

Spotify and calendar integrations, Gmail newsletter parsing, Slack scraping, Telegram chat,
weekly digest, and the multi-user plans.
