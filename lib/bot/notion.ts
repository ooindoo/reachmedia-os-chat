/**
 * Notion for the bot, through the project's direct Notion integration
 * (NOTION_TOKEN), not Composio.
 *  - Clienti: read-only, only Stato = "Attivo" (the only write is the "Email"
 *    field, and only with a list the user confirmed)
 *  - Task: writes ONLY Task, Cliente, Deadline, Stato ("Not started"), Tipo attività
 *    (Cliente and Tipo attività only when they apply), plus a link to the
 *    calendar event in the page body. Tasks for unanswered client mail write
 *    Task, Cliente, Deadline, Stato and "Link Gmail".
 */
import { Client } from "@notionhq/client";
import { isoToRomeLocal, notionDatetime, todayRome } from "../tz";
import { toNotionId } from "../notion";
import { CLIENTI_DATA_SOURCE_ID, TASK_DATA_SOURCE_ID } from "./config";
import type { TipoAttivita } from "../clients";

let notionClient: Client | null = null;
export function notion(): Client {
  if (!notionClient) notionClient = new Client({ auth: process.env.NOTION_TOKEN });
  return notionClient;
}

// ── Clienti ───────────────────────────────────────────────────────────────────

export interface ActiveClient {
  id: string;
  nome: string;
  /** "Tipo" in Clienti (Klaviyo, Shopify, Airbnb) */
  tipo: string | null;
  /** "Email" in Clienti: lowercase addresses ("a@b.it") and domains ("b.it"). */
  email: string[];
}

/** "a@b.it, @c.com; d.org" → ["a@b.it", "c.com", "d.org"] */
export function parseClientEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase().replace(/^@/, ""))
    .filter((x) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(x) || /^[a-z0-9.-]+\.[a-z]{2,}$/.test(x));
}

let clientsCache: { at: number; list: ActiveClient[] } | null = null;
const CLIENTS_TTL_MS = 10 * 60 * 1000;

export async function getActiveClients(fresh = false): Promise<ActiveClient[]> {
  if (!fresh && clientsCache && Date.now() - clientsCache.at < CLIENTS_TTL_MS) return clientsCache.list;
  const list: ActiveClient[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion().dataSources.query({
      data_source_id: CLIENTI_DATA_SOURCE_ID,
      filter: { property: "Stato", select: { equals: "Attivo" } },
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = (page as any).properties ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nome = (props.Nome?.title ?? []).map((t: any) => t.plain_text).join("").trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const email = parseClientEmails((props.Email?.rich_text ?? []).map((t: any) => t.plain_text).join(""));
      if (nome) list.push({ id: page.id, nome, tipo: props.Tipo?.select?.name ?? null, email });
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  clientsCache = { at: Date.now(), list };
  return list;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Exact match first, then a loose "contains" match on the normalized name. */
export async function findActiveClient(name: string | null | undefined): Promise<ActiveClient | null> {
  if (!name?.trim()) return null;
  const clients = await getActiveClients();
  const n = norm(name);
  return (
    clients.find((c) => norm(c.nome) === n) ??
    clients.find((c) => norm(c.nome).includes(n) || n.includes(norm(c.nome))) ??
    null
  );
}

/** The only active client of Tipo "Airbnb", if there is exactly one. */
export async function findAirbnbClient(): Promise<ActiveClient | null> {
  const airbnb = (await getActiveClients()).filter((c) => c.tipo === "Airbnb");
  return airbnb.length === 1 ? airbnb[0] : null;
}

// ── Task ──────────────────────────────────────────────────────────────────────

export async function createTask(t: {
  titolo: string; clienteId: string | null; data: string; ora: string; tipo: TipoAttivita | null;
}): Promise<{ pageId: string; url: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Task: { title: [{ text: { content: t.titolo } }] },
    Deadline: { date: { start: notionDatetime(t.data, t.ora) } },
    Stato: { status: { name: "Not started" } },
  };
  if (t.clienteId) properties.Cliente = { relation: [{ id: toNotionId(t.clienteId) }] };
  if (t.tipo) properties["Tipo attività"] = { select: { name: t.tipo } };
  const page = await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: TASK_DATA_SOURCE_ID },
    properties,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { pageId: page.id, url: (page as any).url ?? `https://www.notion.so/${page.id.replace(/-/g, "")}` };
}

/** Adds the calendar event link to the task page body. */
export async function addEventLink(pageId: string, eventUrl: string): Promise<void> {
  await notion().blocks.children.append({
    block_id: pageId,
    children: [{
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: "📅 Evento in calendario", link: { url: eventUrl } } }] },
    }],
  });
}

export async function updateTaskDeadline(pageId: string, data: string, ora: string): Promise<void> {
  await notion().pages.update({
    page_id: pageId,
    properties: { Deadline: { date: { start: notionDatetime(data, ora) } } },
  });
}

/** Moves the page to Notion's trash (recoverable), never a hard delete. */
export async function trashPage(pageId: string): Promise<void> {
  await notion().pages.update({ page_id: pageId, in_trash: true });
}

// ── Open tasks (briefing and evening plan) ────────────────────────────────────

export interface OpenTask {
  id: string;
  titolo: string;
  giorno: string;        // Deadline day, Rome (YYYY-MM-DD)
  ora: string | null;    // Deadline time when it has one
  conCliente: boolean;
  /** Task of an unanswered client mail (has "Link Gmail"): shown in "📧 Da rispondere" instead. */
  email: boolean;
}

/** Tasks not Done with Deadline on or before `day` (YYYY-MM-DD, Rome), oldest first. */
export async function getOpenTasksUntil(day: string): Promise<OpenTask[]> {
  const out: OpenTask[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion().dataSources.query({
      data_source_id: TASK_DATA_SOURCE_ID,
      filter: {
        and: [
          { property: "Stato", status: { does_not_equal: "Done" } },
          { property: "Deadline", date: { on_or_before: day } },
        ],
      },
      sorts: [{ property: "Deadline", direction: "ascending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = (page as any).properties ?? {};
      const start: string | undefined = props.Deadline?.date?.start;
      if (!start) continue;
      const local = start.includes("T") ? isoToRomeLocal(start) : { date: start, time: null };
      if (local.date > day) continue; // datetime just past midnight in UTC terms
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const titolo = (props.Task?.title ?? []).map((t: any) => t.plain_text).join("").trim() || "(senza titolo)";
      out.push({
        id: page.id, titolo, giorno: local.date, ora: local.time,
        conCliente: (props.Cliente?.relation ?? []).length > 0,
        email: Boolean(props["Link Gmail"]?.url),
      });
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out;
}

/** "✅ Fatto" button: Stato → Done. Returns the task title. */
export async function markTaskDone(pageId: string): Promise<string> {
  const page = await notion().pages.update({
    page_id: pageId,
    properties: { Stato: { status: { name: "Done" } } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const title = ((page as any).properties?.Task?.title ?? []).map((t: any) => t.plain_text).join("");
  return title || "(senza titolo)";
}

// ── Email tasks ("Link Gmail") ─────────────────────────────────────────────────

export interface EmailTask {
  id: string;
  titolo: string;
  link: string;
  done: boolean;
  /** ISO time of the last edit (a client mail newer than this reopens a Done task). */
  modificata: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEmailTask(page: any): EmailTask {
  const props = page.properties ?? {};
  return {
    id: page.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    titolo: (props.Task?.title ?? []).map((t: any) => t.plain_text).join("").trim() || "(senza titolo)",
    link: props["Link Gmail"]?.url ?? "",
    done: props.Stato?.status?.name === "Done",
    modificata: page.last_edited_time,
  };
}

/** Open tasks with a "Link Gmail". */
export async function getOpenEmailTasks(): Promise<EmailTask[]> {
  const out: EmailTask[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion().dataSources.query({
      data_source_id: TASK_DATA_SOURCE_ID,
      filter: {
        and: [
          { property: "Link Gmail", url: { is_not_empty: true } },
          { property: "Stato", status: { does_not_equal: "Done" } },
        ],
      },
      start_cursor: cursor,
      page_size: 100,
    });
    out.push(...res.results.map(toEmailTask));
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out;
}

/** The most recent task (any state) whose "Link Gmail" contains this thread ID. */
export async function findEmailTask(threadId: string): Promise<EmailTask | null> {
  const res = await notion().dataSources.query({
    data_source_id: TASK_DATA_SOURCE_ID,
    filter: { property: "Link Gmail", url: { contains: threadId } },
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    page_size: 1,
  });
  return res.results.length ? toEmailTask(res.results[0]) : null;
}

/** Task for an unanswered client mail: Task, Cliente (when known), Deadline (today), Stato, Link Gmail. */
export async function createEmailTask(t: { titolo: string; clienteIds: string[]; link: string }): Promise<EmailTask> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Task: { title: [{ text: { content: t.titolo } }] },
    Deadline: { date: { start: todayRome() } },
    Stato: { status: { name: "Not started" } },
    "Link Gmail": { url: t.link },
  };
  // No client for a shared sender (e.g. iStudios) when the mail names none.
  if (t.clienteIds.length) properties.Cliente = { relation: t.clienteIds.map((id) => ({ id: toNotionId(id) })) };
  const page = await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: TASK_DATA_SOURCE_ID },
    properties,
  });
  return toEmailTask(page);
}

/** The client wrote again after the reply: same task back to "Not started", Deadline today. */
export async function reopenEmailTask(pageId: string, titolo: string): Promise<void> {
  await notion().pages.update({
    page_id: pageId,
    properties: {
      Task: { title: [{ text: { content: titolo } }] },
      Deadline: { date: { start: todayRome() } },
      Stato: { status: { name: "Not started" } },
    },
  });
}

/** Writes the "Email" field of a client (only after the user confirmed the list). */
export async function setClientEmails(clientId: string, value: string): Promise<void> {
  await notion().pages.update({
    page_id: clientId,
    properties: { Email: { rich_text: value ? [{ text: { content: value } }] : [] } },
  });
  clientsCache = null;
}
