import { NextRequest, NextResponse } from "next/server";
import { searchInvoices } from "@/lib/invoice-update";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q       = searchParams.get("q") ?? "";
    const cliente = searchParams.get("cliente") ?? "";
    if (!q.trim()) {
      return NextResponse.json({ error: "Query mancante" }, { status: 400 });
    }
    const invoices = await searchInvoices(q, cliente || undefined);
    return NextResponse.json({ invoices });
  } catch (err: unknown) {
    const e = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Errore ricerca fatture", detail: e }, { status: 500 });
  }
}
