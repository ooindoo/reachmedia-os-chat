import { NextRequest, NextResponse } from "next/server";
import { createNotionTask } from "@/lib/notion";
import type { TaskData } from "@/lib/notion";

export async function POST(req: NextRequest) {
  try {
    const { task }: { task: TaskData } = await req.json();
    if (!task?.titolo) {
      return NextResponse.json({ error: "Dati task non validi" }, { status: 400 });
    }
    const page = await createNotionTask(task);
    const url = (page as { url?: string }).url ?? null;
    return NextResponse.json({ success: true, url, id: page.id });
  } catch (err: unknown) {
    // Surface the real Notion error message for debugging
    let message = "Errore nella creazione della task su Notion";
    let details: unknown = null;

    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      // Notion SDK wraps errors with .message and sometimes .body
      if (typeof e.message === "string") message = e.message;
      if (e.body) details = e.body;
      else if (e.code) details = e.code;
    }

    console.error("Create task error:", message, details ?? "");
    return NextResponse.json(
      { error: message, details },
      { status: 500 }
    );
  }
}
