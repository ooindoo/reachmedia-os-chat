import { Client } from "@notionhq/client";
import { CLIENTS } from "./clients";
import type { TipoAttivita, Priorita, Canale, BloccatoDa, ApprovazioneCliente } from "./clients";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotionPage = Record<string, any>;

/**
 * Notion page IDs are stored as raw hex (32 chars, no dashes).
 * The relation API requires UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export function toNotionId(raw: string): string {
  const h = raw.replace(/-/g, "");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

export interface TaskData {
  titolo: string;
  cliente: string;
  deadline: string;
  priorita: Priorita;
  tipoAttivita: TipoAttivita;
  canale?: Canale;
  bloccatoDa?: BloccatoDa;
  approvazioneCliente?: ApprovazioneCliente;
  // Client-side only — NOT saved to Notion
  reminderDate?: string;
  reminderTime?: string;
}

export async function createNotionTask(task: TaskData): Promise<NotionPage> {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const dbId = process.env.NOTION_TASK_DB!;
  const clientInfo = CLIENTS[task.cliente];

  // ── DEBUG: log exactly what's being sent for Cliente ─────────────────────
  const clienteRelation = clientInfo ? [{ id: toNotionId(clientInfo.id) }] : [];
  console.log("[Notion] task.cliente:", task.cliente);
  console.log("[Notion] clientInfo:", JSON.stringify(clientInfo));
  console.log("[Notion] Cliente relation payload:", JSON.stringify(clienteRelation));
  // ─────────────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Task:            { title: [{ text: { content: task.titolo } }] },
    Cliente:         { relation: clienteRelation },
    Deadline:        { date: { start: task.deadline } },
    "Priorità":      { select: { name: task.priorita } },
    "Tipo attività": { select: { name: task.tipoAttivita } },
    Stato:           { status: { name: "Not started" } },
  };

  if (task.canale)              properties["Canale"]               = { select: { name: task.canale } };
  if (task.bloccatoDa)          properties["Bloccato da"]          = { select: { name: task.bloccatoDa } };
  if (task.approvazioneCliente) properties["Approvazione cliente"] = { select: { name: task.approvazioneCliente } };

  console.log("[Notion] Full Cliente property:", JSON.stringify(properties["Cliente"]));

  return notion.pages.create({ parent: { database_id: dbId }, properties }) as Promise<NotionPage>;
}
