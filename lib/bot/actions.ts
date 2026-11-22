/**
 * Deterministic actions shared by the Claude agent and the button callbacks:
 * turning a draft into event (+ Notion task), and undoing it.
 */
import { AREAS, MIN_DURATION_MINUTES, isTipoTaskNotion } from "./config";
import { createEvent, deleteEvent } from "./calendar";
import { createTask, findActiveClient, trashPage } from "./notion";
import type { Azione, Draft } from "./log";
import { addMinutesLocal, formatDayShort } from "../tz";

/**
 * Creates the event and, for deliverable client work, the Notion task first
 * (its link goes in the event description). If the event fails, the task is
 * moved to the trash so nothing is left half-done.
 */
export async function createFromDraft(d: Draft, ora: string, bozza?: number): Promise<Azione[]> {
  const azioni: Azione[] = [];
  let task: { pageId: string; url: string } | null = null;

  // Notion task only for deliverable client work in the "Lavoro clienti" area.
  if (d.area === "lavoro_clienti" && d.creaTaskNotion && isTipoTaskNotion(d.tipoAttivita)) {
    const cliente = await findActiveClient(d.cliente);
    if (cliente) {
      task = await createTask({ titolo: d.titolo, clienteId: cliente.id, data: d.data, ora, tipo: d.tipoAttivita });
      azioni.push({ tipo: "task_creata", bozza, pageId: task.pageId, url: task.url, titolo: d.titolo });
    }
  }

  const descrizione = [
    d.note?.trim() || null,
    task ? `📝 Task Notion: ${task.url}` : null,
    "— reachmedia OS bot",
  ].filter(Boolean).join("\n\n");

  try {
    const ev = await createEvent({
      area: d.area, titolo: d.titolo, data: d.data, ora, durataMinuti: d.durataMinuti,
      categoria: d.categoria, descrizione, notionPageId: task?.pageId,
    });
    azioni.push({
      tipo: "evento_creato", bozza, area: ev.area, calendarId: ev.calendarId, eventId: ev.eventId,
      titolo: ev.titolo, data: ev.data, ora: ev.ora, fineOra: ev.fineOra, htmlLink: ev.htmlLink,
      categoria: d.categoria,
      ...(task ? { taskUrl: task.url } : {}),
    });
  } catch (err) {
    if (task) await trashPage(task.pageId).catch(() => {});
    throw err;
  }
  return azioni;
}

/** Dry run of createFromDraft: same decisions (task or not, end time), no writes. */
export async function planFromDraft(d: Draft, ora: string): Promise<Azione[]> {
  const cliente =
    d.area === "lavoro_clienti" && d.creaTaskNotion && isTipoTaskNotion(d.tipoAttivita)
      ? await findActiveClient(d.cliente)
      : null;
  const fine = addMinutesLocal(d.data, ora, Math.max(MIN_DURATION_MINUTES, d.durataMinuti || MIN_DURATION_MINUTES));
  return [{
    tipo: "evento_creato", area: d.area, calendarId: AREAS[d.area].calendarId, eventId: "DRY-RUN",
    titolo: d.titolo, data: d.data, ora, fineOra: fine.time, categoria: d.categoria,
    ...(cliente ? { taskUrl: `(task Notion per ${cliente.nome}, ${d.tipoAttivita})` } : {}),
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
            (a.taskUrl ? " · 📝 task Notion" : "")
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
