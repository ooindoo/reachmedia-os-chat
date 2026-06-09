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
    const httpStatus = typeof e.status === "number" ? e.status : 0;
    const msg = String(e.message ?? "");
    // Notion returns 404 when a page ID is stale or the integration lost access
    if (httpStatus === 404 || msg.toLowerCase().includes("could not find page")) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(
      { error: String(e.message ?? "Errore aggiornamento task"), details: e.body },
      { status: 500 }
    );
  }
}
