import { Client } from "@notionhq/client";
import { CLIENTS } from "./clients";
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
  dataEmissione: string;  // YYYY-MM-DD
  dataScadenza: string;   // YYYY-MM-DD
}

export async function createNotionInvoice(invoice: InvoiceData): Promise<AnyPage> {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const clientInfo = CLIENTS[invoice.cliente];

  return notion.pages.create({
    parent: { database_id: process.env.NOTION_FATTURE_DB! },
    properties: {
      Descrizione: { title: [{ text: { content: invoice.descrizione } }] },
      Cliente: { relation: clientInfo ? [{ id: clientInfo.id }] : [] },
      "Importo lordo": { number: invoice.importoLordo },
      Mese: { select: { name: invoice.mese } },
      Anno: { select: { name: invoice.anno } },
      "Stato pagamento": { select: { name: invoice.statoPagamento } },
      "Metodo pagamento": { select: { name: invoice.metodoPagamento } },
      "Tipo documento": { select: { name: invoice.tipoDocumento } },
      "Data emissione": { date: { start: invoice.dataEmissione } },
      "Data scadenza pagamento": { date: { start: invoice.dataScadenza } },
    },
  }) as AnyPage;
}
