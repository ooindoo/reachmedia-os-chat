import { NextRequest, NextResponse } from "next/server";
import { parseTask } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: "Messaggio vuoto" }, { status: 400 });
    }
    const task = await parseTask(message);
    return NextResponse.json({ task });
  } catch (err) {
    console.error("Parse error:", err);
    return NextResponse.json(
      { error: "Errore nell'interpretazione del messaggio" },
      { status: 500 }
    );
  }
}
