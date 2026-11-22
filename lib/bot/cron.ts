import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

/** Vercel sends `Authorization: Bearer <CRON_SECRET>` on scheduled runs. */
export function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
