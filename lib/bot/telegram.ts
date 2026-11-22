/** Minimal Telegram Bot API client (plain text messages, inline keyboards). */

export interface InlineButton { text: string; callback_data: string }
export type InlineKeyboard = InlineButton[][];

export interface TgMessage {
  message_id: number;
  chat: { id: number };
  from?: { id: number };
  text?: string;
}
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

export async function sendMessage(chatId: number | string, text: string, keyboard?: InlineKeyboard): Promise<number> {
  const msg = await tg<TgMessage>("sendMessage", {
    chat_id: chatId,
    text,
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
  return msg.message_id;
}

export async function editMessage(
  chatId: number | string, messageId: number, text: string, keyboard?: InlineKeyboard
): Promise<void> {
  await tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard ?? [] },
  }).catch(async (e: Error) => {
    // Editing to identical content is not an error worth surfacing.
    if (/message is not modified/i.test(e.message)) return;
    // The action already succeeded: if the old message can't be edited
    // (deleted, too old...), say it in a new message instead of failing.
    await sendMessage(chatId, text, keyboard);
  });
}

export async function answerCallback(callbackId: string, text?: string): Promise<void> {
  await tg("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) }).catch(() => {});
}

export async function sendTyping(chatId: number | string): Promise<void> {
  await tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}
