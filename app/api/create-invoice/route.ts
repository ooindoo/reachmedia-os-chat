import { NextRequest, NextResponse } from "next/server";
import { createNotionInvoice } from "@/lib/invoice";
import type { InvoiceData } from "@/lib/invoice";

export async function POST(req: NextRequest) {
  try {
    const { invoice }: { invoice: InvoiceData } = await req.json();
    if (!invoice?.descrizione) {
      return NextResponse.json({ error: "Dati fattura non validi" }, { status: 400 });
    }
    const page = await createNotionInvoice(invoice);
    return NextResponse.json({ success: true, url: page.url, id: page.id });
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    return NextResponse.json(
      { error: String(e.message ?? "Errore creazione fattura"), details: e.body },
      { status: 500 }
    );
  }
}
