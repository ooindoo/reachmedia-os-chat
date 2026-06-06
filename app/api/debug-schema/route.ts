import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export async function GET() {
  try {
    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    const db = await notion.databases.retrieve({
      database_id: process.env.NOTION_TASK_DB!,
    });

    // Extract property names and types
    const props = Object.entries(db.properties).map(([name, prop]) => ({
      name,
      type: prop.type,
    }));

    return NextResponse.json({ ok: true, properties: props });
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    return NextResponse.json(
      { ok: false, error: e.message ?? String(err) },
      { status: 500 }
    );
  }
}
