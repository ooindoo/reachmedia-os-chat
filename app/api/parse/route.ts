import { NextRequest, NextResponse } from "next/server";
import { parseIntent } from "@/lib/ai";
import { fetchNotionContext } from "@/lib/notion-context";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: "Messaggio vuoto" }, { status: 400 });
    }

    // Fetch live Notion data in parallel — best-effort, never blocks the request
    const context = await fetchNotionContext().catch(() => "");

    const result = await parseIntent(message, context || undefined);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message_err = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("Parse error — message:", message_err);
    console.error("Parse error — stack:", stack);
    return NextResponse.json(
      { error: "Errore nell'interpretazione del messaggio", detail: message_err },
      { status: 500 }
    );
  }
}
