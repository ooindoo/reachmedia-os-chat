/**
 * Telegram webhook management. Uses the custom domain: vercel.app URLs are
 * behind Deployment Protection (SSO) and would answer 401 to Telegram.
 *
 *   npx tsx scripts/set-webhook.ts info     # show the current webhook (no secrets)
 *   npx tsx scripts/set-webhook.ts set      # register https://chat.reachmedia.it/api/telegram
 *   npx tsx scripts/set-webhook.ts delete   # remove it (needed for scripts/bot-local.ts)
 *
 * TELEGRAM_WEBHOOK_SECRET must be the same value set on Vercel.
 */
process.loadEnvFile(".env.local");

const WEBHOOK_URL = "https://chat.reachmedia.it/api/telegram";

async function tg(method: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await res.json()) as { ok: boolean; result?: any; description?: string };
}

async function info() {
  const r = await tg("getWebhookInfo");
  const w = r.result ?? {};
  console.log({
    url: w.url || "(nessuno)",
    pending_update_count: w.pending_update_count,
    last_error_date: w.last_error_date ? new Date(w.last_error_date * 1000).toISOString() : null,
    last_error_message: w.last_error_message ?? null,
    allowed_updates: w.allowed_updates ?? null,
  });
}

async function main() {
  const cmd = process.argv[2] ?? "info";
  if (cmd === "info") return info();
  if (cmd === "delete") {
    const r = await tg("deleteWebhook", { drop_pending_updates: false });
    console.log("deleteWebhook:", r.ok, r.description ?? "");
    return info();
  }
  if (cmd === "set") {
    if (!process.env.TELEGRAM_WEBHOOK_SECRET) throw new Error("TELEGRAM_WEBHOOK_SECRET mancante");
    const r = await tg("setWebhook", {
      url: WEBHOOK_URL,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
      max_connections: 5,
    });
    console.log("setWebhook:", r.ok, r.description ?? "");
    return info();
  }
  throw new Error(`Comando sconosciuto: ${cmd}`);
}

main().catch((e) => {
  console.error("Errore:", (e as Error).message);
  process.exit(1);
});

export {};
