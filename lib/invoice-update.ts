import { Client } from "@notionhq/client";
import { CLIENTS } from "./clients";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPage = Record<string, any>;

const NOTION_VERSION = "2022-06-28";

export interface InvoiceUpdate {
  statoPagamento?: string;
}

export interface InvoiceSearchResult {
  id: string;
  descrizione: string;
  cliente: string;
  importo: number;
  statoPagamento: string;
  url: string;
}

async function queryDatabase(dbId: string, body: AnyPage): Promise<AnyPage[]> {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error((err as AnyPage).message ?? "Notion query failed");
  }
  const data = (await res.json()) as AnyPage;
  return data.results as AnyPage[];
}

function buildDescFilter(query: string) {
  const words = query
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-ZÀ-ÿ0-9]/g, ""))
    .filter((w) => w.length >= 2);
  const candidates = Array.from(new Set([query, ...words]));
  if (candidates.length === 1) {
    return { property: "Descrizione", title: { contains: candidates[0] } };
  }
  return { or: candidates.map((c) => ({ property: "Descrizione", title: { contains: c } })) };
}

function mapPage(page: AnyPage): InvoiceSearchResult {
  const props = page.properties as Record<string, AnyPage>;
  const descrizione    = String(props.Descrizione?.title?.[0]?.plain_text ?? "");
  const importo        = Number(props["Importo lordo"]?.number ?? 0);
  const statoPagamento = String(props["Stato pagamento"]?.select?.name ?? "");
  const clienteId      = String(props.Cliente?.relation?.[0]?.id ?? "").replace(/-/g, "");
  const clienteEntry   = Object.values(CLIENTS).find((c) => c.id === clienteId);
  const cliente        = clienteEntry?.name ?? "";
  return {
    id: String(page.id),
    descrizione,
    cliente,
    importo,
    statoPagamento,
    url: String(page.url),
  };
}

export async function searchInvoices(
  query: string,
  clienteName?: string
): Promise<InvoiceSearchResult[]> {
  const dbId       = process.env.NOTION_FATTURE_DB!;
  const clientInfo = clienteName ? CLIENTS[clienteName] : undefined;

  const descF = buildDescFilter(query);
  const filter: AnyPage = clientInfo
    ? { and: [descF, { property: "Cliente", relation: { contains: clientInfo.id } }] }
    : descF;

  let results = await queryDatabase(dbId, { filter, page_size: 5 });

  // Fallback: search only by client
  if (results.length === 0 && clientInfo) {
    results = await queryDatabase(dbId, {
      filter: { property: "Cliente", relation: { contains: clientInfo.id } },
      sorts: [{ property: "Data emissione", direction: "descending" }],
      page_size: 5,
    });
  }

  return results.map(mapPage);
}

export async function updateNotionInvoice(
  invoiceId: string,
  updates: InvoiceUpdate
): Promise<{ url: string }> {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};
  if (updates.statoPagamento) {
    properties["Stato pagamento"] = { select: { name: updates.statoPagamento } };
  }
  const page = (await notion.pages.update({ page_id: invoiceId, properties })) as AnyPage;
  return { url: String(page.url) };
}
