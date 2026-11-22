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
import { markDoneInMessage } from "./briefing";
import { markTaskDone } from "./notion";
import { createFromDraft, describe, undoCreations } from "./actions";
import {
  STATI, compactId, createLog, findPendingQuestion, findWaitingForTypedTime, getLog, isUpdateLogged, updateLog,
  type Azione, type LogRow, type Sospeso, type Stato,
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

export interface HandlerOptions {
  /** Decide everything without calendar/Notion task writes (log rows are still written). */
  dryRun?: boolean;
  /** Replaces the Telegram reply for text messages (used by tests). */
  reply?: (text: string, keyboard?: InlineKeyboard) => Promise<void>;
}

export async function handleUpdate(update: TgUpdate, opts: HandlerOptions = {}): Promise<void> {
  if (update.message) return handleMessage(update.update_id, update.message, opts);
  if (update.callback_query) return handleCallback(update.update_id, update.callback_query);
}

// ── Text messages ─────────────────────────────────────────────────────────────

async function handleMessage(updateId: number, msg: TgMessage, opts: HandlerOptions): Promise<void> {
  const chatId = msg.chat.id;
  const say = opts.reply ?? (async (t: string, k?: InlineKeyboard) => { await sendMessage(chatId, t, k); });
  if (!isAllowed(chatId, msg.from?.id)) {
    console.warn("[bot] messaggio ignorato da chat non autorizzata");
    return;
  }
  const text = msg.text?.trim();
  if (!text) {
    await say("Per ora leggo solo messaggi di testo.");
    return;
  }
  if (text === "/start") {
    await say("Scrivimi cosa devi fare e quando (es. \"calcetto venerdì alle 20\"): lo metto in calendario.");
    return;
  }
  if (await isUpdateLogged(updateId)) return; // Telegram retry of an update we already handled

  const logId = await createLog(text, updateId);
  if (!opts.reply) await sendTyping(chatId);

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

  // A bot question still open. Within 60 minutes Claude gets that exchange and
  // says whether this message answers it (merge and complete) or not. If not,
  // or if the question expired, the reply reminds the user: the request stays
  // answerable for one more round, then it is closed with a notice.
  const found = await findPendingQuestion().catch(() => null);
  const pending = found?.row.sospeso ? found : null;
  const storia = pending && !pending.scaduta ? pending.row.sospeso!.conversazione : [];

  let result;
  try {
    result = await runAgent(text, { dryRun: opts.dryRun, storia });
  } catch (err) {
    await updateLog(logId, { stato: STATI.errore, errore: errMsg(err) }).catch(() => {});
    await say(`❌ Errore: ${errMsg(err)}`);
    return;
  }
  if (found) await updateLog(found.row.id, { stato: STATI.nessuna }).catch(() => {});
  const { azioni, bozze, errori, domanda, promemoria, rispostaSospeso, testo } = result;

  // The pending request this message did not answer (moved on, or expired).
  const lasciato = pending && !(storia.length && rispostaSospeso === true) ? pending.row.sospeso! : null;
  let avviso: string | null = null;
  let riproposto: Sospeso | null = null;
  if (lasciato) {
    const richiesta = lasciato.conversazione.find((t) => t.ruolo === "utente")?.testo ?? "richiesta";
    if (!lasciato.ricordata && !domanda) {
      avviso = `⚠️ ${lasciato.promemoria ?? `È rimasto in sospeso "${richiesta}": me lo dici?`}`;
      riproposto = { ...lasciato, ricordata: true };
    } else {
      avviso = `⚠️ Chiusa senza risposta: "${richiesta}".`;
    }
  }

  const lines = describe(azioni);
  if (errori.length) lines.push(`⚠️ ${testo || "Qualcosa non è andato a buon fine."}`);
  if (domanda) lines.push(domanda);
  if (!azioni.length && !bozze.length && !domanda) {
    lines.splice(0, lines.length, (errori.length ? "❌ " : "") + (testo || "Non ho trovato niente da mettere in calendario."));
  }
  if (avviso) lines.push(avviso);
  const reply = lines.join("\n");

  if (reply) await say(reply, hasCreation(azioni) ? undoKeyboard(logId) : undefined);

  for (let i = 0; i < bozze.length; i++) {
    const d = bozze[i];
    await say(`⏰ A che ora? ${d.titolo} · ${AREAS[d.area].label} · ${formatDayShort(d.data)}`, timeKeyboard(logId, i));
  }

  // What stays waiting for an answer on this row: a new question (with the
  // previous exchange only if this message continued it), or the reminded one.
  const sospeso: Sospeso | null = domanda
    ? {
        conversazione: [
          ...(rispostaSospeso === true ? storia : []),
          { ruolo: "utente" as const, testo: text },
          { ruolo: "bot" as const, testo: domanda },
        ].slice(-8),
        promemoria,
        ricordata: false,
      }
    : riproposto;

  const stato: Stato = sospeso
    ? STATI.attesaRisposta
    : bozze.length
      ? STATI.attesaOra
      : azioni.length
        ? STATI.ok
        : errori.length ? STATI.errore : STATI.nessuna;
  await updateLog(logId, {
    stato, azioni, bozze, sospeso, risposta: reply,
    ...(errori.length ? { errore: errori.join("\n") } : {}),
  });
}

// ── Buttons ───────────────────────────────────────────────────────────────────

async function handleCallback(updateId: number, cq: TgCallbackQuery): Promise<void> {
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

  // "✅ Fatto" under the morning briefing: f:<task page id>:<line number>.
  // Marks the Notion task Done; the calendar event is not touched.
  if (kind === "f") {
    await handleTaskDone(updateId, cq, chatId, logHex, Number(a));
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

async function handleTaskDone(
  updateId: number, cq: TgCallbackQuery, chatId: number, taskHex: string, n: number
): Promise<void> {
  try {
    const titolo = await markTaskDone(taskHex);
    await answerCallback(cq.id, "Fatto ✅");
    if (cq.message?.text) {
      const next = markDoneInMessage(cq.message.text, cq.message.reply_markup?.inline_keyboard ?? [], n);
      await editMessage(chatId, cq.message.message_id, next.text, next.keyboard);
    }
    if (!(await isUpdateLogged(updateId))) {
      const logId = await createLog(`✅ Fatto: ${titolo}`, updateId);
      await updateLog(logId, { stato: STATI.ok, azioni: [{ tipo: "task_completata", pageId: taskHex, titolo }] });
    }
  } catch (err) {
    await answerCallback(cq.id, "Errore");
    await sendMessage(chatId, `❌ Non sono riuscito a segnare la task come fatta: ${errMsg(err)}`);
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
