import { NextRequest, NextResponse } from "next/server";
import { buildEveningPlan } from "@/lib/bot/briefing";
import { cronAuthorized } from "@/lib/bot/cron";
import { sendMessage } from "@/lib/bot/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Evening plan for tomorrow, 21:00 Europe/Rome (vercel.json "schedules"). Only to the allowed chat. */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (!chatId) return NextResponse.json({ ok: false, error: "TELEGRAM_ALLOWED_CHAT_ID mancante" }, { status: 500 });
  try {
    await sendMessage(chatId, await buildEveningPlan());
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sera] errore:", message);
    await sendMessage(chatId, `⚠️ Piano della sera non riuscito: ${message}`).catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
