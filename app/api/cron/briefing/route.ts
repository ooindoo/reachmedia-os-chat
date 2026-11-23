import { NextRequest, NextResponse } from "next/server";
import { buildMorningBriefing } from "@/lib/bot/briefing";
import { mailLinesForBriefing } from "@/lib/bot/email-check";
import { cronAuthorized } from "@/lib/bot/cron";
import { esc, sendMessage } from "@/lib/bot/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Morning briefing, 8:00 Europe/Rome (vercel.json "schedules"), with the mail check. Only to the allowed chat. */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (!chatId) return NextResponse.json({ ok: false, error: "TELEGRAM_ALLOWED_CHAT_ID mancante" }, { status: 500 });
  try {
    const mail = await mailLinesForBriefing();
    const { text, keyboard } = await buildMorningBriefing(undefined, mail);
    await sendMessage(chatId, text, keyboard.length ? keyboard : undefined, { html: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[briefing] errore:", message);
    await sendMessage(chatId, `⚠️ Briefing del mattino non riuscito: ${esc(message)}`, undefined, { html: true }).catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
