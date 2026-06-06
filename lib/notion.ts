import { Client } from "@notionhq/client";
import { CLIENTS } from "./clients";
import type { TipoAttivita, Priorita } from "./clients";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export interface TaskData {
  titolo: string;
  cliente: string;
  deadline: string; // ISO date string YYYY-MM-DD
  priorita: Priorita;
  tipoAttivita: TipoAttivita;
}

export async function createNotionTask(task: TaskData) {
  const dbId = process.env.NOTION_TASK_DB!;
  const clientInfo = CLIENTS[task.cliente];

  const response = await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      Task: {
        title: [{ text: { content: task.titolo } }],
      },
      Cliente: {
        relation: clientInfo ? [{ id: clientInfo.id }] : [],
      },
      Deadline: {
        date: { start: task.deadline },
      },
      Priorità: {
        select: { name: task.priorita },
      },
      "Tipo attività": {
        select: { name: task.tipoAttivita },
      },
      Stato: {
        status: { name: "Not started" },
      },
    },
  });

  return response;
}
