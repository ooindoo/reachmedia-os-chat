import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/bot/cron";
import { emailProblems, emailSection, runEmailCheck } from "@/lib/bot/email-check";
import { esc, sendMessage } from "@/lib/bot/telegram";
import { rfc3339Rome, todayRome } from "@/lib/tz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 14:00 Europe/Rome (vercel.json "schedules"): mail check. A message only when
 * client mail arrived after 8:00 today and is still without a reply.
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (!chatId) return NextResponse.json({ ok: false, error: "TELEGRAM_ALLOWED_CHAT_ID mancante" }, { status: 500 });
  try {
    const r = await runEmailCheck();
    const daStamattina = Date.parse(rfc3339Rome(todayRome(), "08:00"));
    const nuove = r.pending.filter((m) => m.ricevuta >= daStamattina);
    const lines = [...emailSection(nuove, "📧 Nuove mail dei clienti"), ...(nuove.length ? emailProblems(r) : [])];
    if (lines.length) await sendMessage(chatId, lines.join("\n"), undefined, { html: true });
    return NextResponse.json({ ok: true, nuove: nuove.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mail] errore:", message);
    await sendMessage(chatId, `⚠️ Controllo mail delle 14 non riuscito: ${esc(message)}`, undefined, { html: true }).catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
