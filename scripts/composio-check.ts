/**
 * Checks the Composio setup for the bot, printing no secrets:
 *  - lists the Google Calendar connected accounts and their owner email
 *  - shows the toolkit version to pin (COMPOSIO_GCAL_TOOLKIT_VERSION)
 *  - with COMPOSIO_USER_ID + COMPOSIO_GCAL_ACCOUNT_ID set, reads one event
 *    window from each of the 5 area calendars to confirm access
 *
 *   npx tsx scripts/composio-check.ts
 */
import { Composio } from "@composio/core";

process.loadEnvFile(".env.local");

function safeError(e: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = e as any;
  return `${err?.status ?? ""} ${err?.error?.error?.slug ?? err?.name ?? "Error"}`.trim();
}

async function main() {
  const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

  let accounts;
  try {
    accounts = await composio.connectedAccounts.list({ toolkitSlugs: ["googlecalendar"] });
  } catch (e) {
    console.error("Composio non raggiungibile con questa chiave:", safeError(e));
    process.exit(1);
  }

  console.log("Account Google Calendar collegati:");
  for (const a of accounts.items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acc = a as any;
    let email = "?";
    try {
      const r = await composio.tools.execute("GOOGLECALENDAR_FIND_EVENT", {
        userId: acc.userId ?? acc.user_id,
        connectedAccountId: acc.id,
        arguments: { calendar_id: "primary", max_results: 1 },
        dangerouslySkipVersionCheck: true,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = r.data as any;
      email = d?.event_data?.summary ?? d?.summary ?? d?.event_data?.event_data?.[0]?.organizer?.email ?? "?";
    } catch {
      /* the email is best-effort */
    }
    console.log(`  - id=${acc.id} userId=${acc.userId ?? acc.user_id} status=${acc.status} email=${email}`);
  }

  try {
    const tool = await composio.tools.getRawComposioToolBySlug("GOOGLECALENDAR_CREATE_EVENT");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log("Versione toolkit googlecalendar:", (tool as any).version);
  } catch (e) {
    console.error("Versione toolkit non letta:", safeError(e));
  }

  if (process.env.COMPOSIO_USER_ID && process.env.COMPOSIO_GCAL_ACCOUNT_ID) {
    const { searchEvents } = await import("../lib/bot/calendar");
    const { AREAS, AREA_KEYS } = await import("../lib/bot/config");
    const { todayRome, shiftDate } = await import("../lib/tz");
    for (const area of AREA_KEYS) {
      try {
        const found = await searchEvents({ da: todayRome(), a: shiftDate(todayRome(), 7), area });
        console.log(`  ✓ ${AREAS[area].label}: accessibile (${found.length} eventi nei prossimi 7 giorni)`);
      } catch (e) {
        console.log(`  ✗ ${AREAS[area].label}: ${(e as Error).message.slice(0, 160)}`);
      }
    }
  } else {
    console.log("COMPOSIO_USER_ID / COMPOSIO_GCAL_ACCOUNT_ID non impostati: salto il controllo dei calendari.");
  }
}

main();
