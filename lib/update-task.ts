import { Client } from "@notionhq/client";
import { CLIENTS } from "./clients";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPage = Record<string, any>;

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

export async function searchTasks(
  query: string,
  clienteName?: string
): Promise<TaskSearchResult[]> {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const dbId = process.env.NOTION_TASK_DB!;

  const titleFilter = { property: "Task", title: { contains: query } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filter: any = titleFilter;
  if (clienteName) {
    const clientInfo = CLIENTS[clienteName];
    if (clientInfo) {
      filter = { and: [titleFilter, { property: "Cliente", relation: { contains: clientInfo.id } }] };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (notion as any).databases.query({
    database_id: dbId,
    filter,
    page_size: 5,
  });

  return (response.results as AnyPage[]).map((page) => {
    const p = page as AnyPage;
    const props = p.properties as Record<string, AnyPage>;

    const titolo = (props.Task?.title?.[0]?.plain_text as string) || "";
    const stato = (props.Stato?.status?.name as string) || "";
    const priorita = (props["Priorità"]?.select?.name as string) || "";
    const deadline = (props.Deadline?.date?.start as string) || "";

    // Resolve client name from relation ID
    const clienteId = ((props.Cliente?.relation?.[0]?.id as string) || "").replace(/-/g, "");
    const clienteEntry = Object.values(CLIENTS).find((c) => c.id === clienteId);
    const cliente = clienteEntry?.name || "";

    return { id: p.id as string, titolo, cliente, stato, priorita, deadline, url: p.url as string };
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
