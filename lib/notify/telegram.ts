// Telegram bot sender — sends event cards with inline star/dismiss buttons.
// Requires TELEGRAM_BOT_TOKEN in .env.local (create via @BotFather on Telegram).
// Requires TELEGRAM_CHAT_ID (your chat ID — get it by messaging @userinfobot).

const API = 'https://api.telegram.org';

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  return t;
}

function chatId(): string {
  const id = process.env.TELEGRAM_CHAT_ID;
  if (!id) throw new Error('Missing TELEGRAM_CHAT_ID');
  return id;
}

export type EventForTelegram = {
  id: string;
  title: string;
  url: string | null;
  starts_at: string | null;
  venue_name: string | null;
  category: string | null;
  price_amount: number | null;
  description: string | null;
  reason?: string; // one-liner from the selector explaining why
};

const CAT_EMOJI: Record<string, string> = {
  music: '🎵', stage: '🎭', networking: '🤝', sport: '⚽', culture: '🎨',
};

export function formatEventMessage(event: EventForTelegram): string {
  const emoji = event.category ? CAT_EMOJI[event.category] ?? '📌' : '📌';
  const when = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Date TBC';
  const where = event.venue_name ?? 'Venue TBC';
  const price = event.price_amount != null && event.price_amount > 0
    ? ` · £${event.price_amount}`
    : '';
  const link = event.url ? `\n\n<a href="${event.url}">More info →</a>` : '';
  const reason = event.reason ? `\n\n💡 ${event.reason}` : '';

  return [
    `${emoji} <b>${event.title}</b>`,
    `📅 ${when}${price}`,
    `📍 ${where}`,
    reason,
    link,
  ].join('\n');
}

export async function sendEvent(event: EventForTelegram): Promise<{ messageId: number }> {
  const text = formatEventMessage(event);
  const calUrl = googleCalendarUrl(event);
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '👍 I\'d go', callback_data: `star:${event.id}` },
        { text: '👎 Skip', callback_data: `dismiss:${event.id}` },
      ],
      [
        { text: '📅 Add to Calendar', url: calUrl },
        ...(event.url ? [{ text: '🔗 More info', url: event.url }] : []),
      ],
    ],
  };

  const res = await fetch(`${API}/bot${token()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId(),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram send failed: ${res.status} ${err}`);
  }

  const data = await res.json() as { result: { message_id: number } };
  return { messageId: data.result.message_id };
}

/** Edit a sent message to show the user's choice (called from webhook after button click).
 *  Keeps calendar and info buttons live so the user can still act after starring. */
export async function updateMessageWithChoice(
  chatId: string,
  messageId: number,
  choice: 'starred' | 'dismissed',
  event?: { title?: string; starts_at?: string | null; venue_name?: string | null; url?: string | null; description?: string | null },
): Promise<void> {
  const choiceLabel = choice === 'starred' ? '⭐ Saved' : '✕ Dismissed';
  const rows: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
    [{ text: choiceLabel, callback_data: 'done' }],
  ];

  // Keep calendar + info buttons if we have event data
  if (event && event.title) {
    const calUrl = googleCalendarUrl({
      id: '',
      title: event.title,
      starts_at: event.starts_at ?? null,
      venue_name: event.venue_name ?? null,
      description: event.description ?? null,
      url: event.url ?? null,
      category: null,
      price_amount: null,
    });
    const actionRow: Array<{ text: string; callback_data?: string; url?: string }> = [
      { text: '📅 Calendar', url: calUrl },
    ];
    if (event.url) {
      actionRow.push({ text: '🔗 Info', url: event.url });
    }
    rows.push(actionRow);
  }

  await fetch(`${API}/bot${token()}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: rows },
    }),
  });
}

/** Answer a callback query to stop the loading spinner on the button. */
export async function answerCallback(callbackId: string, text?: string): Promise<void> {
  await fetch(`${API}/bot${token()}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  });
}

function googleCalendarUrl(event: EventForTelegram): string {
  const title = encodeURIComponent(event.title);
  const details = encodeURIComponent([event.description, event.url].filter(Boolean).join('\n\n'));
  const location = encodeURIComponent(event.venue_name ?? '');

  let dates = '';
  if (event.starts_at) {
    const start = event.starts_at.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const startDate = new Date(event.starts_at);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const end = endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    dates = `${start}/${end}`;
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}&sf=true&output=xml`;
}
