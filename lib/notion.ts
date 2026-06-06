import { Client } from "@notionhq/client";
import { CLIENTS } from "./clients";
import type { TipoAttivita, Priorita } from "./clients";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotionPage = Record<string, any>;

export interface TaskData {
  titolo: string;
  cliente: string;
  deadline: string;       // YYYY-MM-DD
  priorita: Priorita;
  tipoAttivita: TipoAttivita;
  // Client-side only — NOT saved to Notion
  reminderDate?: string;  // YYYY-MM-DD
  reminderTime?: string;  // HH:MM
}

export async function createNotionTask(task: TaskData): Promise<NotionPage> {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const dbId = process.env.NOTION_TASK_DB!;
  const clientInfo = CLIENTS[task.cliente];

  const page = await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      // "Task" is the title field
      Task: {
        title: [{ text: { content: task.titolo } }],
      },
      // Relation to the client page
      Cliente: {
        relation: clientInfo ? [{ id: clientInfo.id }] : [],
      },
      // Date
      Deadline: {
        date: { start: task.deadline },
      },
      // Select field for priority
      "Priorità": {
        select: { name: task.priorita },
      },
      // Select field for task type
      "Tipo attività": {
        select: { name: task.tipoAttivita },
      },
      // Status field
      Stato: {
        status: { name: "Not started" },
      },
    },
  }) as NotionPage;

  return page;
}
