import { Client } from "@notionhq/client";
import { CLIENTS } from "./clients";
import type { TipoAttivita, Priorita, Canale, BloccatoDa, ApprovazioneCliente } from "./clients";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotionPage = Record<string, any>;

export interface TaskData {
  titolo: string;
  cliente: string;
  deadline: string;                      // YYYY-MM-DD
  priorita: Priorita;
  tipoAttivita: TipoAttivita;
  canale?: Canale;                        // optional — saved if set
  bloccatoDa?: BloccatoDa;               // default: ➖ Non bloccato
  approvazioneCliente?: ApprovazioneCliente; // default: ➖ Non necessaria
  // Client-side only — NOT saved to Notion
  reminderDate?: string;
  reminderTime?: string;
}

export async function createNotionTask(task: TaskData): Promise<NotionPage> {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const dbId = process.env.NOTION_TASK_DB!;
  const clientInfo = CLIENTS[task.cliente];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Task:          { title: [{ text: { content: task.titolo } }] },
    Cliente:       { relation: clientInfo ? [{ id: clientInfo.id }] : [] },
    Deadline:      { date: { start: task.deadline } },
    "Priorità":    { select: { name: task.priorita } },
    "Tipo attività": { select: { name: task.tipoAttivita } },
    Stato:         { status: { name: "Not started" } },
  };

  if (task.canale)               properties["Canale"] = { select: { name: task.canale } };
  if (task.bloccatoDa)           properties["Bloccato da"] = { select: { name: task.bloccatoDa } };
  if (task.approvazioneCliente)  properties["Approvazione cliente"] = { select: { name: task.approvazioneCliente } };

  return notion.pages.create({ parent: { database_id: dbId }, properties }) as Promise<NotionPage>;
}
