import { Client } from "@notionhq/client";
import { CLIENTS } from "./clients";
import type { TipoSessione, Energia, Fatturabile } from "./clients";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPage = Record<string, any>;

export interface TimeLogData {
  descrizione: string;
  cliente: string;
  oreLavorate: number;
  data: string;   // YYYY-MM-DD
  ora: string;    // HH:MM — se non vuoto salva come datetime
  tipoSessione: TipoSessione;
  energia: Energia;
  fatturabile: Fatturabile;
}

export async function createNotionTimeLog(timelog: TimeLogData): Promise<AnyPage> {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const clientInfo = CLIENTS[timelog.cliente];

  // Build date value: datetime if ora is set, else date-only
  const dateStart = timelog.ora
    ? `${timelog.data}T${timelog.ora}:00.000+01:00`
    : timelog.data;

  return notion.pages.create({
    parent: { database_id: process.env.NOTION_TIMELOG_DB! },
    properties: {
      "Descrizione sessione": { title: [{ text: { content: timelog.descrizione } }] },
      Cliente: { relation: clientInfo ? [{ id: clientInfo.id }] : [] },
      "Ore lavorate": { number: timelog.oreLavorate },
      Data: { date: { start: dateStart } },
      "Tipo sessione": { select: { name: timelog.tipoSessione } },
      Energia: { select: { name: timelog.energia } },
      Fatturabile: { select: { name: timelog.fatturabile } },
    },
  }) as AnyPage;
}
