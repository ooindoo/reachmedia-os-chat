/**
 * Morning briefing (8:00) and evening plan (21:00), Europe/Rome.
 *
 *  🎯 Le 3 cose  – at most 3 things to do (never fixed appointments), by priority:
 *                  1. open Notion tasks with an earlier Deadline
 *                  2. payments and external deadlines (Burocrazia e soldi, "pratica")
 *                  3. client work (Lavoro clienti, tasks with a client)
 *                  4. any other thing to do
 *  📅 Il resto   – the other events of the day, by time
 *  📌 Da recuperare (morning only) – other earlier open tasks, max 3 + "e altre N"
 *
 * Morning items backed by a Notion task get a "✅ Fatto" button (see handler.ts).
 */
import { listAllCalendars, listEventsOn, type DayEvent } from "./calendar";
import { getOpenTasksUntil, type OpenTask } from "./notion";
import { shiftDate, todayRome, weekdayIt } from "../tz";
import type { InlineKeyboard } from "./telegram";

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MAX_COSE = 3;
const MAX_RECUPERARE = 3;

function dataLunga(date: string): string {
  const [, mo, d] = date.split("-").map(Number);
  const g = weekdayIt(date);
  return `${g.charAt(0).toUpperCase()}${g.slice(1)} ${d} ${MESI[mo - 1]}`;
}

const norm = (id: string) => id.replace(/-/g, "").toLowerCase();

/** Is this calendar event a thing to do (vs a fixed appointment that happens anyway)? */
function isCosaDaFare(e: DayEvent): boolean {
  if (e.tipo) return e.tipo === "cosa_da_fare";                    // saved by the bot
  if (e.notionPageId) return true;                                  // has a Notion task
  if (e.categoria) return e.categoria === "pratica" || e.categoria === "scadenza_lavoro";
  return e.area === "burocrazia_soldi" || e.area === "lavoro_clienti"; // created by hand
}

function prioritaEvento(e: DayEvent): number {
  if (e.categoria === "pratica" || e.area === "burocrazia_soldi") return 2;
  if (e.categoria === "scadenza_lavoro" || e.area === "lavoro_clienti") return 3;
  return 4;
}

interface Cosa {
  titolo: string;
  ora: string | null;
  calendario: string | null;
  taskId: string | null;
  eventKey: string | null;
  priorita: number;
  ordine: string;
}

export interface DayPlan {
  giorno: string;
  eventi: DayEvent[];       // all events of the day, by time
  cose: Cosa[];             // "Le 3 cose"
  resto: DayEvent[];        // events not in "Le 3 cose"
  daRecuperare: OpenTask[]; // earlier open tasks not in "Le 3 cose"
}

export async function buildDayPlan(giorno: string): Promise<DayPlan> {
  const calendars = await listAllCalendars();
  const perCal = await Promise.all(calendars.map((c) => listEventsOn(c, giorno)));

  // Same event in two calendars (e.g. an invite): keep the first, area calendars come first.
  const seen = new Set<string>();
  const eventi: DayEvent[] = [];
  for (const e of perCal.flat()) {
    if (seen.has(e.key)) continue;
    seen.add(e.key);
    eventi.push(e);
  }
  eventi.sort((a, b) => (a.ora ?? "").localeCompare(b.ora ?? ""));

  const tasks = await getOpenTasksUntil(giorno);
  // Link task and event: by the ID saved on the event, or (events made by hand)
  // by the same title on the same day. A linked event shows the task's button.
  const titoloKey = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");
  for (const e of eventi) {
    if (e.notionPageId) continue;
    const t = tasks.find((x) => x.giorno === giorno && titoloKey(x.titolo) === titoloKey(e.titolo));
    if (t) e.notionPageId = t.id;
  }
  const taskInEventi = new Set(eventi.filter((e) => e.notionPageId).map((e) => norm(e.notionPageId!)));
  const precedenti = tasks.filter((t) => t.giorno < giorno && !taskInEventi.has(norm(t.id)));
  const delGiorno = tasks.filter((t) => t.giorno === giorno && !taskInEventi.has(norm(t.id)));

  const candidati: Cosa[] = [
    ...precedenti.map((t) => ({
      titolo: t.titolo, ora: null, calendario: null, taskId: t.id, eventKey: null,
      priorita: 1, ordine: `${t.giorno} ${t.ora ?? ""}`,
    })),
    ...eventi.filter(isCosaDaFare).map((e) => ({
      titolo: e.titolo, ora: e.ora, calendario: e.calendario, taskId: e.notionPageId, eventKey: e.key,
      priorita: prioritaEvento(e), ordine: e.ora ?? "99:99",
    })),
    ...delGiorno.map((t) => ({
      titolo: t.titolo, ora: t.ora, calendario: null, taskId: t.id, eventKey: null,
      priorita: t.conCliente ? 3 : 4, ordine: t.ora ?? "99:99",
    })),
  ];
  candidati.sort((a, b) => a.priorita - b.priorita || a.ordine.localeCompare(b.ordine));
  const cose = candidati.slice(0, MAX_COSE);

  const scelteEventi = new Set(cose.map((c) => c.eventKey).filter(Boolean));
  const scelteTask = new Set(cose.map((c) => c.taskId && norm(c.taskId)).filter(Boolean));
  return {
    giorno,
    eventi,
    cose,
    resto: eventi.filter((e) => !scelteEventi.has(e.key)),
    daRecuperare: precedenti.filter((t) => !scelteTask.has(norm(t.id))),
  };
}

function rigaCosa(c: Cosa): string {
  return [c.ora, c.titolo].filter(Boolean).join(" ") + (c.calendario ? ` — ${c.calendario}` : "");
}

function rigaEvento(e: DayEvent): string {
  return `• ${e.ora ?? "tutto il giorno"} ${e.titolo} — ${e.calendario}`;
}

function bottone(n: number, titolo: string, taskId: string) {
  const corto = titolo.length > 28 ? `${titolo.slice(0, 27)}…` : titolo;
  return [{ text: `✅ Fatto ${n}. ${corto}`, callback_data: `f:${norm(taskId)}:${n}` }];
}

/** 8:00 message, with a "✅ Fatto" button for each numbered item backed by a Notion task. */
export async function buildMorningBriefing(giorno: string = todayRome()): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const p = await buildDayPlan(giorno);
  const titolo = `☀️ Buongiorno! ${dataLunga(giorno)}`;
  if (!p.eventi.length && !p.cose.length && !p.daRecuperare.length) {
    return { text: `${titolo}\nNiente in calendario oggi e niente da recuperare.`, keyboard: [] };
  }

  const lines = [titolo];
  const keyboard: InlineKeyboard = [];
  let n = 0;
  if (p.cose.length) {
    lines.push("", "🎯 Le 3 cose di oggi");
    for (const c of p.cose) {
      n++;
      lines.push(`${n}. ${rigaCosa(c)}`);
      if (c.taskId) keyboard.push(bottone(n, c.titolo, c.taskId));
    }
  }
  if (p.resto.length) {
    lines.push("", "📅 Il resto di oggi", ...p.resto.map(rigaEvento));
  }
  if (p.daRecuperare.length) {
    lines.push("", "📌 Da recuperare");
    for (const t of p.daRecuperare.slice(0, MAX_RECUPERARE)) {
      n++;
      lines.push(`${n}. ${t.titolo}`);
      keyboard.push(bottone(n, t.titolo, t.id));
    }
    const altre = p.daRecuperare.length - MAX_RECUPERARE;
    if (altre > 0) lines.push(`e altre ${altre}`);
  }
  return { text: lines.join("\n"), keyboard };
}

/** 21:00 message about tomorrow: the 3 things and the other events. No buttons. */
export async function buildEveningPlan(oggi: string = todayRome()): Promise<string> {
  const domani = shiftDate(oggi, 1);
  const p = await buildDayPlan(domani);
  if (!p.eventi.length && !p.cose.length) {
    return `🌙 Domani (${dataLunga(domani)}) niente in calendario e niente da fare.`;
  }
  const lines = [`🌙 Domani · ${dataLunga(domani)}`];
  if (p.cose.length) {
    lines.push("", "🎯 Le 3 cose di domani", ...p.cose.map((c, i) => `${i + 1}. ${rigaCosa(c)}`));
  }
  if (p.resto.length) {
    lines.push("", "📅 Il resto di domani", ...p.resto.map(rigaEvento));
  }
  return lines.join("\n");
}

/** After "✅ Fatto": mark line n as done and drop its button. */
export function markDoneInMessage(text: string, keyboard: InlineKeyboard, n: number) {
  const prefix = `${n}. `;
  const nextText = text
    .split("\n")
    .map((l) => (l.startsWith(prefix) && !l.startsWith(`${prefix}✅`) ? `${prefix}✅ ${l.slice(prefix.length)} (fatto)` : l))
    .join("\n");
  const nextKeyboard = keyboard.filter((row) => !row.some((b) => b.callback_data.endsWith(`:${n}`)));
  return { text: nextText, keyboard: nextKeyboard };
}
