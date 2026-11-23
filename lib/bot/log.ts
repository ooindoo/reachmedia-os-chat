/**
 * "🤖 Bot Log" database in Notion (NOTION_LOG_DB = data source ID).
 * One row per incoming Telegram message. It records what was received and
 * every action taken (with event / page IDs), and it also holds the bot's
 * state: drafts waiting for a time, a question waiting for an answer, and
 * what the "Annulla" button undoes.
 */
import { notion } from "./notion";
import type { Area, Categoria } from "./config";
import type { TipoAttivita } from "../clients";
import type { FoundEvent } from "./calendar";

export const STATI = {
  ok: "✅ Ok",
  errore: "❌ Errore",
  attesaOra: "⏳ Attesa ora",
  attesaOraScritta: "⌨️ Attesa ora scritta",
  attesaRisposta: "❓ Attesa risposta",
  annullato: "↩️ Annullato",
  nessuna: "ℹ️ Nessuna azione",
} as const;
export type Stato = (typeof STATI)[keyof typeof STATI];

/** An event to create, possibly still without a time. */
export interface Draft {
  titolo: string;
  area: Area;
  data: string;
  ora: string | null;
  durataMinuti: number;
  categoria: Categoria;
  cliente: string | null;
  tipoAttivita: TipoAttivita | null;
  /** "Cosa da fare" (event + Notion task) rather than an appointment (event only). */
  creaTaskNotion: boolean;
  note: string | null;
  /** Explicit end time ("dalle 11 alle 11:15"), kept even under 30 minutes. */
  oraFine?: string | null;
  /** Set once the draft has been turned into an event. */
  completata?: boolean;
}

export type Azione =
  | {
      tipo: "evento_creato"; bozza?: number; area: Area; calendarId: string; eventId: string;
      titolo: string; data: string; ora: string; fineOra: string; htmlLink?: string;
      categoria?: Categoria; taskUrl?: string; annullato?: boolean;
      /** The Notion task should have been created but Notion failed (the event was created anyway). */
      taskErrore?: string;
    }
  | { tipo: "task_creata"; bozza?: number; pageId: string; url: string; titolo: string; annullato?: boolean }
  | {
      tipo: "evento_modificato"; area: Area; calendarId: string; eventId: string;
      prima: FoundEvent; titolo: string; data: string; ora: string; fineOra: string;
    }
  | {
      tipo: "evento_ricreato"; daArea: Area; area: Area; prima: FoundEvent;
      calendarId: string; eventId: string; titolo: string; data: string; ora: string; fineOra: string;
    }
  | { tipo: "evento_eliminato"; area: Area; calendarId: string; eventId: string; prima: FoundEvent }
  | { tipo: "task_completata"; pageId: string; titolo: string };

/** One turn of a pending conversation (the bot asked something). */
export interface Turno {
  ruolo: "utente" | "bot";
  testo: string;
}

/** A request waiting for the user's answer to a bot question. */
export interface Sospeso {
  conversazione: Turno[];
  /** Sentence shown if the user moves on, e.g. "Ross1000 è rimasto senza data: me la dici?" */
  promemoria: string | null;
  /** Already reminded once: next time it is closed for good. */
  ricordata: boolean;
}

export interface LogRow {
  id: string;
  stato: Stato | null;
  azioni: Azione[];
  bozze: Draft[];
  /** Index of the draft waiting for a typed time ("Altro"). */
  bozzaInAttesa: number | null;
  /** Request waiting for an answer, when Stato is "Attesa risposta". */
  sospeso: Sospeso | null;
  /** What the bot replied (also the history given to Claude). */
  risposta: string;
}

/** How long a bot question waits for an answer before the next message counts as new. */
export const PENDING_QUESTION_MINUTES = 60;

const MAX_CHUNK = 2000;

function richText(s: string) {
  const chunks: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < s.length && chunks.length < 100; i += MAX_CHUNK) {
    chunks.push({ type: "text", text: { content: s.slice(i, i + MAX_CHUNK) } });
  }
  return chunks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readText(prop: any): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prop?.rich_text ?? []).map((t: any) => t.plain_text).join("");
}

function logDs(): string {
  const id = process.env.NOTION_LOG_DB;
  if (!id) throw new Error("Variabile d'ambiente mancante: NOTION_LOG_DB");
  return id;
}

export async function createLog(messaggio: string, updateId: number): Promise<string> {
  const page = await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: logDs() },
    properties: {
      Messaggio: { title: richText(messaggio.slice(0, 2000) || "(vuoto)") },
      "Update ID": { number: updateId },
      Stato: { select: { name: STATI.nessuna } },
    },
  });
  return page.id;
}

export async function updateLog(
  id: string,
  patch: {
    stato?: Stato;
    azioni?: Azione[];
    bozze?: Draft[];
    bozzaInAttesa?: number | null;
    sospeso?: Sospeso | null;
    risposta?: string;
    errore?: string;
  }
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};
  if (patch.stato) properties.Stato = { select: { name: patch.stato } };
  if (patch.risposta !== undefined) properties.Risposta = { rich_text: richText(patch.risposta) };
  if (patch.errore !== undefined) properties.Errore = { rich_text: richText(patch.errore) };
  if (patch.azioni) {
    properties.Azioni = { rich_text: richText(JSON.stringify(patch.azioni)) };
    const events = patch.azioni.filter(
      (a): a is Extract<Azione, { eventId: string }> => "eventId" in a && a.tipo !== "evento_eliminato"
    );
    properties["Event ID"] = { rich_text: richText(events.map((a) => a.eventId).join(", ")) };
    properties.Calendario = {
      rich_text: richText(Array.from(new Set(events.map((a) => a.calendarId))).join(", ")),
    };
    const task = patch.azioni.find((a) => a.tipo === "task_creata");
    properties["Notion Task"] = { url: task && task.tipo === "task_creata" ? task.url : null };
  }
  if (patch.bozze !== undefined || patch.bozzaInAttesa !== undefined || patch.sospeso !== undefined) {
    const needsCurrent =
      patch.bozze === undefined || patch.bozzaInAttesa === undefined || patch.sospeso === undefined;
    const current = needsCurrent ? await getLog(id) : null;
    const bozze = patch.bozze ?? current?.bozze ?? [];
    const inAttesa = patch.bozzaInAttesa !== undefined ? patch.bozzaInAttesa : current?.bozzaInAttesa ?? null;
    const sospeso = patch.sospeso !== undefined ? patch.sospeso : current?.sospeso ?? null;
    properties.Bozza = {
      rich_text:
        bozze.length || sospeso
          ? richText(JSON.stringify({ bozze, inAttesa, ...(sospeso ? { sospeso } : {}) }))
          : [],
    };
  }
  await notion().pages.update({ page_id: id, properties });
}

export async function getLog(id: string): Promise<LogRow> {
  const page = await notion().pages.retrieve({ page_id: id });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = (page as any).properties ?? {};
  const azioniRaw = readText(props.Azioni);
  const bozzaRaw = readText(props.Bozza);
  const bozza = bozzaRaw
    ? (JSON.parse(bozzaRaw) as { bozze?: Draft[]; inAttesa?: number | null; sospeso?: Sospeso })
    : null;
  return {
    id: page.id,
    stato: (props.Stato?.select?.name as Stato) ?? null,
    azioni: azioniRaw ? (JSON.parse(azioniRaw) as Azione[]) : [],
    bozze: bozza?.bozze ?? [],
    bozzaInAttesa: bozza?.inAttesa ?? null,
    sospeso: bozza?.sospeso ?? null,
    risposta: readText(props.Risposta),
  };
}

/** Telegram re-sends an update if our answer is late: skip ones already logged. */
export async function isUpdateLogged(updateId: number): Promise<boolean> {
  const res = await notion().dataSources.query({
    data_source_id: logDs(),
    filter: { property: "Update ID", number: { equals: updateId } },
    page_size: 1,
  });
  return res.results.length > 0;
}

/** Most recent row waiting for a typed time, if "Altro" was pressed in the last 30 min. */
export async function findWaitingForTypedTime(): Promise<LogRow | null> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const res = await notion().dataSources.query({
    data_source_id: logDs(),
    filter: {
      and: [
        { property: "Stato", select: { equals: STATI.attesaOraScritta } },
        { timestamp: "last_edited_time", last_edited_time: { on_or_after: since } },
      ],
    },
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    page_size: 1,
  });
  return res.results[0] ? getLog(res.results[0].id) : null;
}

/**
 * Most recent row whose bot question is still open. `scaduta` is true when
 * it is older than PENDING_QUESTION_MINUTES: then the new message is not
 * treated as its answer, the user is only reminded.
 */
export async function findPendingQuestion(): Promise<{ row: LogRow; scaduta: boolean } | null> {
  const res = await notion().dataSources.query({
    data_source_id: logDs(),
    filter: { property: "Stato", select: { equals: STATI.attesaRisposta } },
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    page_size: 1,
  });
  const page = res.results[0];
  if (!page) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edited = new Date((page as any).last_edited_time).getTime();
  const scaduta = Date.now() - edited > PENDING_QUESTION_MINUTES * 60 * 1000;
  return { row: await getLog(page.id), scaduta };
}

/** How far back the conversation given to Claude goes. */
export const HISTORY_MINUTES = 60;
const MAX_HISTORY = 6;

/**
 * Last exchanges (user message → bot reply) of the past HISTORY_MINUTES,
 * oldest first, so Claude can resolve "modifica l'orario", "sì quello"...
 */
export async function getRecentExchanges(since?: string): Promise<Turno[]> {
  const from = since ?? new Date(Date.now() - HISTORY_MINUTES * 60 * 1000).toISOString();
  const res = await notion().dataSources.query({
    data_source_id: logDs(),
    filter: { timestamp: "created_time", created_time: { on_or_after: from } },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    page_size: MAX_HISTORY,
  });
  const turni: Turno[] = [];
  for (const page of [...res.results].reverse()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = (page as any).properties ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messaggio = (props.Messaggio?.title ?? []).map((t: any) => t.plain_text).join("").trim();
    if (!messaggio || messaggio.startsWith("✅ Fatto:")) continue;
    turni.push({ ruolo: "utente", testo: messaggio });
    turni.push({ ruolo: "bot", testo: readText(props.Risposta).trim() || "(nessuna risposta)" });
  }
  return turni;
}

/** Same text received in the last 2 minutes (a message sent twice by mistake). */
export async function isRecentDuplicate(text: string): Promise<boolean> {
  const from = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const res = await notion().dataSources.query({
    data_source_id: logDs(),
    filter: {
      and: [
        { property: "Messaggio", title: { equals: text } },
        { timestamp: "created_time", created_time: { on_or_after: from } },
      ],
    },
    page_size: 1,
  });
  return res.results.length > 0;
}

/** Notion page IDs travel in callback_data without dashes (64-byte limit). */
export function compactId(id: string): string {
  return id.replace(/-/g, "");
}
