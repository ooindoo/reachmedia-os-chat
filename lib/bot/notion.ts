/**
 * Notion for the bot, through the project's direct Notion integration
 * (NOTION_TOKEN), not Composio.
 *  - Clienti: read-only, only Stato = "Attivo"
 *  - Task: writes ONLY Task, Cliente, Deadline, Stato ("Not started"), Tipo attività
 *    (Cliente and Tipo attività only when they apply), plus a link to the
 *    calendar event in the page body
 */
import { Client } from "@notionhq/client";
import { notionDatetime } from "../tz";
import { toNotionId } from "../notion";
import { CLIENTI_DATA_SOURCE_ID } from "./config";
import type { TipoAttivita } from "../clients";

let notionClient: Client | null = null;
export function notion(): Client {
  if (!notionClient) notionClient = new Client({ auth: process.env.NOTION_TOKEN });
  return notionClient;
}

// ── Clienti ───────────────────────────────────────────────────────────────────

export interface ActiveClient { id: string; nome: string }

let clientsCache: { at: number; list: ActiveClient[] } | null = null;
const CLIENTS_TTL_MS = 10 * 60 * 1000;

export async function getActiveClients(): Promise<ActiveClient[]> {
  if (clientsCache && Date.now() - clientsCache.at < CLIENTS_TTL_MS) return clientsCache.list;
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
      if (nome) list.push({ id: page.id, nome });
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
    parent: { type: "data_source_id", data_source_id: process.env.NOTION_TASK_DB! },
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
