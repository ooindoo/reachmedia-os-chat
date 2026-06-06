import { NextRequest, NextResponse } from "next/server";
import { updateNotionTask } from "@/lib/update-task";
import type { TaskUpdate } from "@/lib/update-task";

export async function POST(req: NextRequest) {
  try {
    const { taskId, updates }: { taskId: string; updates: TaskUpdate } = await req.json();
    if (!taskId) {
      return NextResponse.json({ error: "ID task mancante" }, { status: 400 });
    }
    const result = await updateNotionTask(taskId, updates);
    return NextResponse.json({ success: true, url: result.url });
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    return NextResponse.json(
      { error: String(e.message ?? "Errore aggiornamento task"), details: e.body },
      { status: 500 }
    );
  }
}
