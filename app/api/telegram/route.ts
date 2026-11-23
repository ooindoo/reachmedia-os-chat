import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { handleUpdate } from "@/lib/bot/handler";
import type { TgUpdate } from "@/lib/bot/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// update_ids already received by this instance. The Bot Log check in the
// handler covers retries over time; this covers two copies of the same update
// arriving at the same moment, before the first one is written to the log.
const seen = new Set<number>();
function firstDelivery(updateId: number): boolean {
  if (seen.has(updateId)) return false;
  seen.add(updateId);
  if (seen.size > 1000) seen.delete(seen.values().next().value as number);
  return true;
}

function secretMatches(received: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Telegram webhook. Registered on https://chat.reachmedia.it/api/telegram
 * (custom domain: vercel.app URLs are behind Deployment Protection).
 * Answers 200 right away and processes in the background, so Telegram
 * doesn't re-send the update while Claude and the calendar are working.
 */
export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (update && typeof update.update_id === "number" && firstDelivery(update.update_id)) {
    waitUntil(
      handleUpdate(update).catch((err) => console.error("[bot] errore non gestito:", err?.message ?? err))
    );
  }
  return NextResponse.json({ ok: true });
}
