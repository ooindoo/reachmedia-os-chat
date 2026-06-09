import { Client } from "@notionhq/client";
import { CLIENTS } from "./clients";
import { toNotionId } from "./notion";
import { notionDatetime } from "./tz";
import type { Mese, Anno, StatoPagamento, MetodoPagamento, TipoDocumento } from "./clients";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPage = Record<string, any>;

export interface InvoiceData {
  descrizione: string;
  cliente: string;
  importoLordo: number;
  mese: Mese;
  anno: Anno;
  statoPagamento: StatoPagamento;
  metodoPagamento: MetodoPagamento;
  tipoDocumento: TipoDocumento;
  dataEmissione: string;     // YYYY-MM-DD
  dataScadenza: string;      // YYYY-MM-DD
  dataEmissioneTime?: string; // HH:MM optional
  dataScadenzaTime?: string;  // HH:MM optional
  // Optional extra fields
  note?: string;
  linkGmail?: string;
}

export async function createNotionInvoice(invoice: InvoiceData): Promise<AnyPage> {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const clientInfo = CLIENTS[invoice.cliente];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Descrizione: { title: [{ text: { content: invoice.descrizione } }] },
    Cliente: { relation: clientInfo ? [{ id: toNotionId(clientInfo.id) }] : [] },
    "Importo lordo": { number: invoice.importoLordo },
    Mese: { select: { name: invoice.mese } },
    Anno: { select: { name: invoice.anno } },
    "Stato pagamento": { select: { name: invoice.statoPagamento } },
    "Metodo pagamento": { select: { name: invoice.metodoPagamento } },
    "Tipo documento": { select: { name: invoice.tipoDocumento } },
    "Data emissione": {
      date: {
        start: invoice.dataEmissioneTime
          ? notionDatetime(invoice.dataEmissione, invoice.dataEmissioneTime)
          : invoice.dataEmissione,
      },
    },
    "Data scadenza pagamento": {
      date: {
        start: invoice.dataScadenzaTime
          ? notionDatetime(invoice.dataScadenza, invoice.dataScadenzaTime)
          : invoice.dataScadenza,
      },
    },
  };

  if (invoice.note?.trim())      properties["Note"]       = { rich_text: [{ text: { content: invoice.note.trim() } }] };
  if (invoice.linkGmail?.trim()) properties["Link Gmail"] = { url: invoice.linkGmail.trim() };

  return notion.pages.create({
    parent: { database_id: process.env.NOTION_FATTURE_DB! },
    properties,
  }) as AnyPage;
}
