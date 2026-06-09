import { CLIENTS } from "./clients";

const NOTION_VERSION = "2022-06-28";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

async function queryDB(dbId: string, body: AnyRecord): Promise<AnyRecord[]> {
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as AnyRecord;
    return (data.results ?? []) as AnyRecord[];
  } catch {
    return [];
  }
}

function clientName(relationId: string): string {
  const normalized = relationId.replace(/-/g, "");
  const entry = Object.values(CLIENTS).find((c) => c.id === normalized);
  return entry?.name ?? "";
}

function sp(v: unknown): string {
  return String(v ?? "").trim();
}

export async function fetchNotionContext(): Promise<string> {
  const taskDb     = process.env.NOTION_TASK_DB;
  const fattureDb  = process.env.NOTION_FATTURE_DB;
  const timelogDb  = process.env.NOTION_TIMELOG_DB;

  if (!taskDb || !fattureDb || !timelogDb) return "";

  const [taskPages, invoicePages, timelogPages] = await Promise.all([
    queryDB(taskDb, {
      filter: { property: "Stato", status: { does_not_equal: "Done" } },
      sorts: [{ property: "Deadline", direction: "ascending" }],
      page_size: 20,
    }),
    queryDB(fattureDb, {
      filter: { property: "Stato pagamento", select: { does_not_equal: "Pagata" } },
      sorts: [{ property: "Data emissione", direction: "descending" }],
      page_size: 10,
    }),
    queryDB(timelogDb, {
      sorts: [{ property: "Data", direction: "descending" }],
      page_size: 5,
    }),
  ]);

  const lines: string[] = ["CONTESTO NOTION (dati aggiornati):"];

  // ── Task aperte ──────────────────────────────────────────────────────────
  lines.push("\nTASK APERTE [id | titolo | cliente | deadline | stato]:");
  if (taskPages.length === 0) {
    lines.push("  (nessuna)");
  } else {
    for (const p of taskPages) {
      const pr  = p.properties as AnyRecord;
      const titolo   = sp(pr.Task?.title?.[0]?.plain_text);
      const stato    = sp(pr.Stato?.status?.name);
      const deadline = sp(pr.Deadline?.date?.start).split("T")[0];
      const cId      = sp(pr.Cliente?.relation?.[0]?.id);
      const cliente  = cId ? clientName(cId) : "";
      lines.push(`  ${p.id} | ${titolo} | ${cliente} | ${deadline} | ${stato}`);
    }
  }

  // ── Fatture in sospeso ───────────────────────────────────────────────────
  lines.push("\nFATTURE IN SOSPESO [id | descrizione | cliente | importo | stato]:");
  if (invoicePages.length === 0) {
    lines.push("  (nessuna)");
  } else {
    for (const p of invoicePages) {
      const pr  = p.properties as AnyRecord;
      const desc    = sp(pr.Descrizione?.title?.[0]?.plain_text);
      const importo = sp(pr["Importo lordo"]?.number);
      const stato   = sp(pr["Stato pagamento"]?.select?.name);
      const cId     = sp(pr.Cliente?.relation?.[0]?.id);
      const cliente = cId ? clientName(cId) : "";
      lines.push(`  ${p.id} | ${desc} | ${cliente} | €${importo} | ${stato}`);
    }
  }

  // ── Time log recenti ─────────────────────────────────────────────────────
  lines.push("\nTIME LOG RECENTI [id | descrizione | cliente | ore | data]:");
  if (timelogPages.length === 0) {
    lines.push("  (nessuno)");
  } else {
    for (const p of timelogPages) {
      const pr  = p.properties as AnyRecord;
      const desc    = sp(pr["Descrizione sessione"]?.title?.[0]?.plain_text);
      const ore     = sp(pr["Ore lavorate"]?.number);
      const data    = sp(pr.Data?.date?.start).split("T")[0];
      const cId     = sp(pr.Cliente?.relation?.[0]?.id);
      const cliente = cId ? clientName(cId) : "";
      lines.push(`  ${p.id} | ${desc} | ${cliente} | ${ore}h | ${data}`);
    }
  }

  return lines.join("\n");
}
