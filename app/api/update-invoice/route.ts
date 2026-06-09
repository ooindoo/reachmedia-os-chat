import { NextRequest, NextResponse } from "next/server";
import { updateNotionInvoice } from "@/lib/invoice-update";
import type { InvoiceUpdate } from "@/lib/invoice-update";

export async function POST(req: NextRequest) {
  try {
    const { invoiceId, updates }: { invoiceId: string; updates: InvoiceUpdate } = await req.json();
    if (!invoiceId) {
      return NextResponse.json({ error: "ID fattura mancante" }, { status: 400 });
    }
    const result = await updateNotionInvoice(invoiceId, updates);
    return NextResponse.json({ success: true, url: result.url });
  } catch (err: unknown) {
    const e = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Errore aggiornamento fattura", detail: e }, { status: 500 });
  }
}
