/**
 * Minimal Telegram Bot API client: plain text or HTML messages, inline keyboards.
 * HTML messages: every dynamic text (titles, names, summaries) goes through
 * esc(), and links through link(), so a "&" or "<" never breaks the message.
 */

export interface InlineButton { text: string; callback_data: string }
export type InlineKeyboard = InlineButton[][];

export interface TgMessage {
  message_id: number;
  chat: { id: number };
  from?: { id: number };
  text?: string;
  entities?: TgEntity[];
  reply_markup?: { inline_keyboard?: InlineKeyboard };
}
export interface TgEntity { type: string; offset: number; length: number; url?: string }
export interface TgCallbackQuery {
  id: string;
  from: { id: number };
  message?: TgMessage;
  data?: string;
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Variabile d'ambiente mancante: TELEGRAM_BOT_TOKEN");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
  return json.result as T;
}

// ── HTML ──────────────────────────────────────────────────────────────────────

/** Escapes text for Telegram HTML (&, <, > and quotes). */
export function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** <a href="url">label</a>, both escaped. */
export function link(url: string, label: string): string {
  return `<a href="${esc(url)}">${esc(label)}</a>`;
}

/**
 * Rebuilds the HTML of a received message from its plain text and entities
 * (Telegram gives back text without tags): links and bold are kept, the rest
 * is escaped. Offsets are UTF-16 units, like JavaScript strings.
 */
export function messageToHtml(msg: Pick<TgMessage, "text" | "entities">): string {
  const text = msg.text ?? "";
  const ents = (msg.entities ?? [])
    .filter((e) => e.type === "text_link" || e.type === "bold")
    .sort((a, b) => a.offset - b.offset);
  let out = "";
  let pos = 0;
  for (const e of ents) {
    if (e.offset < pos) continue; // nested/overlapping: keep the outer one only
    out += esc(text.slice(pos, e.offset));
    const inner = text.slice(e.offset, e.offset + e.length);
    out += e.type === "text_link" && e.url ? link(e.url, inner) : `<b>${esc(inner)}</b>`;
    pos = e.offset + e.length;
  }
  return out + esc(text.slice(pos));
}

export interface SendOptions { html?: boolean }

export async function sendMessage(
  chatId: number | string, text: string, keyboard?: InlineKeyboard, opts: SendOptions = {}
): Promise<number> {
  const msg = await tg<TgMessage>("sendMessage", {
    chat_id: chatId,
    text,
    ...(opts.html ? { parse_mode: "HTML" } : {}),
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
  return msg.message_id;
}

export async function editMessage(
  chatId: number | string, messageId: number, text: string, keyboard?: InlineKeyboard, opts: SendOptions = {}
): Promise<void> {
  await tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...(opts.html ? { parse_mode: "HTML" } : {}),
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard ?? [] },
  }).catch(async (e: Error) => {
    // Editing to identical content is not an error worth surfacing.
    if (/message is not modified/i.test(e.message)) return;
    // The action already succeeded: if the old message can't be edited
    // (deleted, too old...), say it in a new message instead of failing.
    await sendMessage(chatId, text, keyboard, opts);
  });
}

export async function answerCallback(callbackId: string, text?: string): Promise<void> {
  await tg("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) }).catch(() => {});
}

export async function sendTyping(chatId: number | string): Promise<void> {
  await tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}
