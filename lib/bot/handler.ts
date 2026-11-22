/**
 * Telegram update handling: text messages go to the Claude agent; button
 * presses (time choice, "Altro", "Annulla") are handled deterministically.
 *
 * callback_data (max 64 bytes), <log> = Bot Log page ID without dashes:
 *   t:<log>:<draft>:<HHMM>  → create the draft at that time
 *   o:<log>:<draft>         → "Altro": wait for a typed time
 *   u:<log>[:<draft>]       → undo the creations (all, or one draft's)
 */
import { AREAS } from "./config";
import { runAgent } from "./agent";
import { createFromDraft, describe, undoCreations } from "./actions";
import {
  STATI, compactId, createLog, findWaitingForTypedTime, getLog, isUpdateLogged, updateLog,
  type Azione, type LogRow, type Stato,
} from "./log";
import {
  answerCallback, editMessage, sendMessage, sendTyping,
  type InlineKeyboard, type TgCallbackQuery, type TgMessage, type TgUpdate,
} from "./telegram";
import { formatDayShort } from "../tz";

const TIME_BUTTONS = ["09:00", "14:00", "18:00"];

function isAllowed(chatId?: number, fromId?: number): boolean {
  const allowed = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (!allowed || chatId === undefined) return false;
  return String(chatId) === allowed && (fromId === undefined || String(fromId) === allowed);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Accepts a message that is only a time: "16", "16:30", "alle 9.15", "ore 18". */
export function parseTypedTime(text: string): string | null {
  const m = text.trim().match(/^(?:alle\s+|ore\s+)?(\d{1,2})(?:[:.](\d{2}))?$/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function undoKeyboard(logId: string, bozza?: number): InlineKeyboard {
  const data = bozza === undefined ? `u:${compactId(logId)}` : `u:${compactId(logId)}:${bozza}`;
  return [[{ text: "↩️ Annulla", callback_data: data }]];
}

function timeKeyboard(logId: string, bozza: number): InlineKeyboard {
  const id = compactId(logId);
  return [
    TIME_BUTTONS.map((t) => ({ text: t, callback_data: `t:${id}:${bozza}:${t.replace(":", "")}` })),
    [{ text: "Altro", callback_data: `o:${id}:${bozza}` }],
  ];
}

function hasCreation(azioni: Azione[]): boolean {
  return azioni.some((a) => a.tipo === "evento_creato" && !a.annullato);
}

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.message) return handleMessage(update.update_id, update.message);
  if (update.callback_query) return handleCallback(update.callback_query);
}

// ── Text messages ─────────────────────────────────────────────────────────────

async function handleMessage(updateId: number, msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  if (!isAllowed(chatId, msg.from?.id)) {
    console.warn("[bot] messaggio ignorato da chat non autorizzata");
    return;
  }
  const text = msg.text?.trim();
  if (!text) {
    await sendMessage(chatId, "Per ora leggo solo messaggi di testo.");
    return;
  }
  if (text === "/start") {
    await sendMessage(chatId, "Scrivimi cosa devi fare e quando (es. \"calcetto venerdì alle 20\"): lo metto in calendario.");
    return;
  }
  if (await isUpdateLogged(updateId)) return; // Telegram retry of an update we already handled

  const logId = await createLog(text, updateId);
  await sendTyping(chatId);

  // A bare time right after "Altro" completes the waiting draft.
  const typed = parseTypedTime(text);
  if (typed) {
    const waiting = await findWaitingForTypedTime();
    if (waiting && waiting.bozzaInAttesa !== null) {
      await completeDraft(waiting, waiting.bozzaInAttesa, typed, chatId);
      await updateLog(logId, { stato: STATI.nessuna, risposta: `Ora ${typed} usata per la bozza del log ${waiting.id}` });
      return;
    }
  }

  let result;
  try {
    result = await runAgent(text);
  } catch (err) {
    await updateLog(logId, { stato: STATI.errore, errore: errMsg(err) }).catch(() => {});
    await sendMessage(chatId, `❌ Errore: ${errMsg(err)}`);
    return;
  }
  const { azioni, bozze, errori, testo } = result;

  const lines = describe(azioni);
  if (errori.length) lines.push(`⚠️ ${testo || "Qualcosa non è andato a buon fine."}`);
  let reply = lines.join("\n");
  if (!azioni.length && !bozze.length) reply = (errori.length ? "❌ " : "") + (testo || "Non ho trovato niente da mettere in calendario.");

  if (reply) await sendMessage(chatId, reply, hasCreation(azioni) ? undoKeyboard(logId) : undefined);

  for (let i = 0; i < bozze.length; i++) {
    const d = bozze[i];
    await sendMessage(
      chatId,
      `⏰ A che ora? ${d.titolo} · ${AREAS[d.area].label} · ${formatDayShort(d.data)}`,
      timeKeyboard(logId, i)
    );
  }

  const stato: Stato = bozze.length
    ? STATI.attesaOra
    : azioni.length
      ? STATI.ok
      : errori.length ? STATI.errore : STATI.nessuna;
  await updateLog(logId, {
    stato, azioni, bozze, risposta: reply, ...(errori.length ? { errore: errori.join("\n") } : {}),
  });
}

// ── Buttons ───────────────────────────────────────────────────────────────────

async function handleCallback(cq: TgCallbackQuery): Promise<void> {
  const chatId = cq.message?.chat.id;
  if (!isAllowed(chatId, cq.from.id) || chatId === undefined) {
    await answerCallback(cq.id);
    return;
  }
  const [kind, logHex, a, b] = (cq.data ?? "").split(":");
  if (!logHex) {
    await answerCallback(cq.id);
    return;
  }

  try {
    const row = await getLog(logHex);

    if (kind === "t") {
      await answerCallback(cq.id, "Creo l'evento…");
      const time = `${b.slice(0, 2)}:${b.slice(2, 4)}`;
      await completeDraft(row, Number(a), time, chatId, cq.message?.message_id);
      return;
    }

    if (kind === "o") {
      const i = Number(a);
      const d = row.bozze[i];
      await answerCallback(cq.id);
      if (!d || d.completata) return;
      await updateLog(row.id, { stato: STATI.attesaOraScritta, bozzaInAttesa: i });
      if (cq.message) {
        await editMessage(chatId, cq.message.message_id, `⌨️ Scrivi l'ora per: ${d.titolo} · ${formatDayShort(d.data)} (es. 16:30)`);
      }
      return;
    }

    if (kind === "u") {
      const bozza = a === undefined ? undefined : Number(a);
      const { azioni, undone } = await undoCreations(row.azioni, bozza);
      if (!undone) {
        await answerCallback(cq.id, "Niente da annullare");
        return;
      }
      const stillActive = azioni.some(
        (x) => (x.tipo === "evento_creato" || x.tipo === "task_creata") && !x.annullato
      );
      await updateLog(row.id, { azioni, ...(stillActive ? {} : { stato: STATI.annullato }) });
      await answerCallback(cq.id, "Annullato");
      if (cq.message) {
        await editMessage(chatId, cq.message.message_id, `${cq.message.text ?? ""}\n↩️ Annullato`);
      }
      return;
    }

    await answerCallback(cq.id);
  } catch (err) {
    await answerCallback(cq.id, "Errore");
    await sendMessage(chatId, `❌ Errore: ${errMsg(err)}`);
    await updateLog(logHex, { errore: errMsg(err) }).catch(() => {});
  }
}

/** Creates a waiting draft at the given time and replies (editing the button message if any). */
async function completeDraft(
  row: LogRow, i: number, time: string, chatId: number, messageId?: number
): Promise<void> {
  const d = row.bozze[i];
  if (!d || d.completata) {
    if (messageId === undefined) await sendMessage(chatId, "Questo evento è già stato creato.");
    return;
  }
  let created: Azione[];
  try {
    created = await createFromDraft(d, time, i);
  } catch (err) {
    await updateLog(row.id, { stato: STATI.errore, errore: errMsg(err) }).catch(() => {});
    await sendMessage(chatId, `❌ Errore: ${errMsg(err)}`);
    return;
  }

  const bozze = row.bozze.map((x, j) => (j === i ? { ...x, completata: true } : x));
  const pending = bozze.some((x) => !x.completata);
  await updateLog(row.id, {
    azioni: [...row.azioni, ...created],
    bozze,
    bozzaInAttesa: null,
    stato: pending ? STATI.attesaOra : STATI.ok,
  });

  const text = describe(created).join("\n");
  if (messageId !== undefined) await editMessage(chatId, messageId, text, undoKeyboard(row.id, i));
  else await sendMessage(chatId, text, undoKeyboard(row.id, i));
}
