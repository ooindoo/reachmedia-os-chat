import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export async function GET() {
  try {
    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    // Use the raw API to avoid TypeScript type issues
    const db = await notion.databases.retrieve({
      database_id: process.env.NOTION_TASK_DB!,
    }) as unknown as {
      properties?: Record<string, { type: string }>;
      object?: string;
    };

    if (!db.properties) {
      return NextResponse.json({ ok: false, error: "No properties found (integration may lack access)" }, { status: 500 });
    }

    const props = Object.entries(db.properties).map(([name, prop]) => ({
      name,
      type: prop.type,
    }));

    return NextResponse.json({ ok: true, properties: props });
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    return NextResponse.json(
      { ok: false, error: String(e.message ?? err) },
      { status: 500 }
    );
  }
}
