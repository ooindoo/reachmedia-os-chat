import { NextRequest, NextResponse } from "next/server";
import { createNotionTimeLog } from "@/lib/timelog";
import type { TimeLogData } from "@/lib/timelog";

export async function POST(req: NextRequest) {
  try {
    const { timelog }: { timelog: TimeLogData } = await req.json();
    if (!timelog?.descrizione) {
      return NextResponse.json({ error: "Dati time log non validi" }, { status: 400 });
    }
    const page = await createNotionTimeLog(timelog);
    return NextResponse.json({ success: true, url: page.url, id: page.id });
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    return NextResponse.json(
      { error: String(e.message ?? "Errore creazione time log"), details: e.body },
      { status: 500 }
    );
  }
}
