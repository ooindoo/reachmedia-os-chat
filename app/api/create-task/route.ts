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
  } catch (err) {
    console.error("Create task error:", err);
    return NextResponse.json(
      { error: "Errore nella creazione della task su Notion" },
      { status: 500 }
    );
  }
}
