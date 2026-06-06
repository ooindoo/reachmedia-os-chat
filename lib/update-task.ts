import { Client } from "@notionhq/client";
import { CLIENTS } from "./clients";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPage = Record<string, any>;

const NOTION_VERSION = "2022-06-28";

export interface TaskSearchResult {
  id: string;
  titolo: string;
  cliente: string;
  stato: string;
  priorita: string;
  deadline: string;
  url: string;
}

export interface TaskUpdate {
  stato?: string;
  priorita?: string;
  bloccatoDa?: string;
  approvazioneCliente?: string;
  tempoReale?: number;
  deadline?: string;
  note?: string;
}

// Use raw fetch because @notionhq/client v5 removed databases.query
async function queryDatabase(
  dbId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: Record<string, any>
): Promise<AnyPage[]> {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({ filter, page_size: 5 }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error((err as AnyPage).message ?? "Notion query failed");
  }

  const data = await res.json() as AnyPage;
  return data.results as AnyPage[];
}

// Build fuzzy OR filter: searches the full phrase AND each individual word (≥3 chars)
function buildTitleFilter(query: string) {
  const words = query
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-ZÀ-ÿ0-9]/g, ""))
    .filter((w) => w.length >= 3);

  const candidates = [query, ...words].filter(
    (v, i, arr) => arr.indexOf(v) === i // dedupe
  );

  if (candidates.length === 1) {
    return { property: "Task", title: { contains: candidates[0] } };
  }
  return {
    or: candidates.map((c) => ({ property: "Task", title: { contains: c } })),
  };
}

export async function searchTasks(
  query: string,
  clienteName?: string
): Promise<TaskSearchResult[]> {
  const dbId = process.env.NOTION_TASK_DB!;
  const titleFilter = buildTitleFilter(query);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filter: Record<string, any> = titleFilter;
  if (clienteName) {
    const clientInfo = CLIENTS[clienteName];
    if (clientInfo) {
      filter = {
        and: [
          titleFilter,
          { property: "Cliente", relation: { contains: clientInfo.id } },
        ],
      };
    }
  }

  const results = await queryDatabase(dbId, filter);

  return results.map((page) => {
    const props = page.properties as Record<string, AnyPage>;

    const titolo   = (props.Task?.title?.[0]?.plain_text as string) || "";
    const stato    = (props.Stato?.status?.name as string) || "";
    const priorita = (props["Priorità"]?.select?.name as string) || "";
    const deadline = (props.Deadline?.date?.start as string) || "";

    const clienteId = ((props.Cliente?.relation?.[0]?.id as string) || "").replace(/-/g, "");
    const clienteEntry = Object.values(CLIENTS).find((c) => c.id === clienteId);
    const cliente = clienteEntry?.name || "";

    return { id: page.id as string, titolo, cliente, stato, priorita, deadline, url: page.url as string };
  });
}

export async function updateNotionTask(
  taskId: string,
  updates: TaskUpdate
): Promise<{ url: string }> {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};
  if (updates.stato)               properties["Stato"] = { status: { name: updates.stato } };
  if (updates.priorita)            properties["Priorità"] = { select: { name: updates.priorita } };
  if (updates.bloccatoDa)          properties["Bloccato da"] = { select: { name: updates.bloccatoDa } };
  if (updates.approvazioneCliente) properties["Approvazione cliente"] = { select: { name: updates.approvazioneCliente } };
  if (updates.tempoReale != null)  properties["Tempo reale (h)"] = { number: updates.tempoReale };
  if (updates.deadline)            properties["Deadline"] = { date: { start: updates.deadline } };
  if (updates.note)                properties["Note"] = { rich_text: [{ text: { content: updates.note } }] };

  const page = await notion.pages.update({ page_id: taskId, properties }) as AnyPage;
  return { url: page.url as string };
}
