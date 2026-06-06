import { NextRequest, NextResponse } from "next/server";
import { searchTasks } from "@/lib/update-task";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const cliente = searchParams.get("cliente") || "";
    if (!query.trim()) {
      return NextResponse.json({ error: "Query mancante" }, { status: 400 });
    }
    const tasks = await searchTasks(query, cliente || undefined);
    return NextResponse.json({ tasks });
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    return NextResponse.json(
      { error: String(e.message ?? "Errore nella ricerca task") },
      { status: 500 }
    );
  }
}
