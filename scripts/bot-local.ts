/**
 * Local test of the Telegram bot, without the webhook (Preview deploys are
 * behind Deployment Protection, Telegram can't reach them).
 *
 * It long-polls Telegram with getUpdates and feeds each update to the same
 * handler used in production, so you can write to @reachmediaos_bot and press
 * the buttons from your phone. Works only while NO webhook is set (Telegram
 * refuses getUpdates when one is active).
 *
 *   npx tsx scripts/bot-local.ts            # poll until Ctrl+C
 *   npx tsx scripts/bot-local.ts "testo"    # run one message, then exit
 */
process.loadEnvFile(".env.local");

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; result?: unknown; description?: string };
}

async function main() {
  // Imported after loading env: the modules read process.env at load time.
  const { handleUpdate } = await import("../lib/bot/handler");
  const chatId = Number(process.env.TELEGRAM_ALLOWED_CHAT_ID);

  const oneShot = process.argv.slice(2).join(" ").trim();
  if (oneShot) {
    await handleUpdate({
      update_id: -Date.now(), // negative: never collides with real Telegram update IDs
      message: { message_id: 0, chat: { id: chatId }, from: { id: chatId }, text: oneShot },
    });
    console.log("Fatto. Risposta inviata su Telegram.");
    return;
  }

  const info = (await tg("getWebhookInfo", {})) as { result?: { url?: string } };
  if (info.result?.url) {
    console.error("Webhook attivo: getUpdates non funziona. Rimuovilo prima di usare il polling locale.");
    process.exit(1);
  }

  console.log("In ascolto su Telegram (Ctrl+C per uscire)…");
  let offset = 0;
  for (;;) {
    const res = (await tg("getUpdates", {
      offset, timeout: 30, allowed_updates: ["message", "callback_query"],
    })) as { ok: boolean; result?: { update_id: number }[]; description?: string };
    if (!res.ok) {
      console.error("getUpdates:", res.description);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    for (const u of res.result ?? []) {
      offset = u.update_id + 1;
      const kind = "message" in u ? "messaggio" : "bottone";
      console.log(`→ update ${u.update_id} (${kind})`);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handleUpdate(u as any);
        console.log("  ok");
      } catch (e) {
        console.error("  errore:", (e as Error).message);
      }
    }
  }
}

main().catch((e) => {
  console.error("Errore:", (e as Error).message);
  process.exit(1);
});

export {};
