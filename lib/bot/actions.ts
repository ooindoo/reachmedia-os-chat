/**
 * Deterministic actions shared by the Claude agent and the button callbacks:
 * turning a draft into event (+ Notion task), and undoing it.
 */
import { AREAS, MIN_DURATION_MINUTES, isTipoAttivita } from "./config";
import { createEvent, deleteEvent } from "./calendar";
import { addEventLink, createTask, findActiveClient, findAirbnbClient, trashPage } from "./notion";
import type { Azione, Draft } from "./log";
import { addMinutesLocal, formatDayShort, minutesBetweenLocal } from "../tz";

/** Client for the task: the one named, or for Airbnb to-dos the active Airbnb client. */
async function taskClient(d: Draft) {
  return (await findActiveClient(d.cliente)) ?? (d.area === "airbnb" ? await findAirbnbClient() : null);
}

/** Duration of a draft: from an explicit end time (kept as written) or the given minutes. */
function durataDi(d: Draft, ora: string): { durataMinuti: number; durataEsatta: boolean } {
  if (d.oraFine) {
    const m = minutesBetweenLocal(d.data, ora, d.data, d.oraFine);
    if (m > 0) return { durataMinuti: m, durataEsatta: true };
  }
  return { durataMinuti: d.durataMinuti, durataEsatta: false };
}

/** A "cosa da fare" gets a Notion task, except personal reminders (calendar only). */
function wantsTask(d: Draft): boolean {
  return d.creaTaskNotion && d.area !== "personale";
}

/**
 * Creates the event and, for a "cosa da fare", the Notion task first (its link
 * goes in the event description, the event link goes in the task page).
 * If Notion fails, the event is created anyway and the reply says the task is
 * missing: nothing gets lost. If the event fails, the task is moved to the
 * trash so nothing is left half-done.
 */
export async function createFromDraft(d: Draft, ora: string, bozza?: number): Promise<Azione[]> {
  const azioni: Azione[] = [];
  let task: { pageId: string; url: string } | null = null;
  let taskErrore: string | undefined;

  if (wantsTask(d)) {
    try {
      const cliente = await taskClient(d);
      task = await createTask({
        titolo: d.titolo, clienteId: cliente?.id ?? null, data: d.data, ora,
        tipo: isTipoAttivita(d.tipoAttivita) ? d.tipoAttivita : null,
      });
      azioni.push({ tipo: "task_creata", bozza, pageId: task.pageId, url: task.url, titolo: d.titolo });
    } catch (err) {
      taskErrore = err instanceof Error ? err.message : String(err);
      console.error("[bot] task Notion non creata:", taskErrore);
    }
  }

  const descrizione = [
    d.note?.trim() || null,
    task ? `📝 Task Notion: ${task.url}` : null,
    "— reachmedia OS bot",
  ].filter(Boolean).join("\n\n");

  try {
    const ev = await createEvent({
      area: d.area, titolo: d.titolo, data: d.data, ora, ...durataDi(d, ora),
      categoria: d.categoria, descrizione, notionPageId: task?.pageId,
      tipo: d.creaTaskNotion ? "cosa_da_fare" : "appuntamento",
    });
    azioni.push({
      tipo: "evento_creato", bozza, area: ev.area, calendarId: ev.calendarId, eventId: ev.eventId,
      titolo: ev.titolo, data: ev.data, ora: ev.ora, fineOra: ev.fineOra, htmlLink: ev.htmlLink,
      categoria: d.categoria,
      ...(task ? { taskUrl: task.url } : {}),
      ...(taskErrore ? { taskErrore } : {}),
    });
    if (task && ev.htmlLink) await addEventLink(task.pageId, ev.htmlLink).catch(() => {});
  } catch (err) {
    if (task) await trashPage(task.pageId).catch(() => {});
    throw err;
  }
  return azioni;
}

/** Dry run of createFromDraft: same decisions (task or not, end time), no writes. */
export async function planFromDraft(d: Draft, ora: string): Promise<Azione[]> {
  const cliente = wantsTask(d) ? await taskClient(d) : null;
  const { durataMinuti, durataEsatta } = durataDi(d, ora);
  const fine = addMinutesLocal(d.data, ora, durataEsatta ? durataMinuti : Math.max(MIN_DURATION_MINUTES, durataMinuti || MIN_DURATION_MINUTES));
  return [{
    tipo: "evento_creato", area: d.area, calendarId: AREAS[d.area].calendarId, eventId: "DRY-RUN",
    titolo: d.titolo, data: d.data, ora, fineOra: fine.time, categoria: d.categoria,
    ...(wantsTask(d)
      ? { taskUrl: `(task Notion · cliente: ${cliente?.nome ?? "—"} · tipo: ${d.tipoAttivita ?? "—"})` }
      : {}),
  }];
}

/** Undo the creations of a log row (optionally only those of one draft). */
export async function undoCreations(azioni: Azione[], bozza?: number): Promise<{ azioni: Azione[]; undone: number }> {
  let undone = 0;
  const next: Azione[] = [];
  for (const a of azioni) {
    const inScope = bozza === undefined || ("bozza" in a && a.bozza === bozza);
    if (inScope && a.tipo === "evento_creato" && !a.annullato) {
      await deleteEvent(a.calendarId, a.eventId);
      next.push({ ...a, annullato: true });
      undone++;
    } else if (inScope && a.tipo === "task_creata" && !a.annullato) {
      await trashPage(a.pageId);
      next.push({ ...a, annullato: true });
      undone++;
    } else {
      next.push(a);
    }
  }
  return { azioni: next, undone };
}

/** One line per action, for the Telegram reply. */
export function describe(azioni: Azione[]): string[] {
  const lines: string[] = [];
  for (const a of azioni) {
    switch (a.tipo) {
      case "evento_creato":
        lines.push(
          `✅ ${a.titolo} · ${AREAS[a.area].label} · ${formatDayShort(a.data)} ${a.ora}–${a.fineOra}` +
            (a.taskUrl ? " · 📝 task Notion" : "") +
            (a.taskErrore ? `\n⚠️ Task Notion non creata: ${a.taskErrore.slice(0, 200)}` : "")
        );
        break;
      case "evento_modificato":
        lines.push(`✏️ ${a.titolo} · ${AREAS[a.area].label} · ${formatDayShort(a.data)} ${a.ora}–${a.fineOra}`);
        break;
      case "evento_ricreato":
        lines.push(
          `🔁 ${a.titolo} spostato da ${AREAS[a.daArea].label} a ${AREAS[a.area].label} · ` +
            `${formatDayShort(a.data)} ${a.ora}–${a.fineOra}`
        );
        break;
      case "evento_eliminato":
        lines.push(
          `🗑 Eliminato: ${a.prima.titolo} · ${AREAS[a.area].label} · ${formatDayShort(a.prima.data)}` +
            (a.prima.ora ? ` ${a.prima.ora}` : "") +
            (a.prima.notionPageId ? " (la task Notion resta)" : "")
        );
        break;
    }
  }
  return lines;
}
