/**
 * Gmail for the bot, through Composio (same project and user as the calendar).
 * Prints no secrets.
 *
 *   npx tsx scripts/gmail-connect.ts link    # auth config (if missing) + 2 connection links
 *   npx tsx scripts/gmail-connect.ts check   # connected Gmail accounts and their address
 *
 * Standard Gmail auth config managed by Composio (a custom one with fewer
 * scopes is blocked by Google as an unverified app). Google grants full Gmail
 * access: the limit is in the code, which can call only 4 tools (lib/bot/gmail.ts).
 */
import { Composio } from "@composio/core";

process.loadEnvFile(".env.local");

const CONFIG_NAME = "reachmedia-os-bot gmail standard";
const MAILBOXES = [
  { alias: "arditnwork", email: "arditnwork@gmail.com" },
  { alias: "agency", email: "email.ma.agency@gmail.com" },
];

function safeError(e: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = e as any;
  return `${err?.status ?? ""} ${err?.error?.error?.slug ?? err?.code ?? err?.name ?? "Error"} ${err?.error?.error?.message ?? ""}`.trim();
}

async function main() {
  const mode = process.argv[2];
  const userId = process.env.COMPOSIO_USER_ID;
  if (!userId) throw new Error("COMPOSIO_USER_ID mancante");
  const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

  if (mode === "link") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any = await composio.authConfigs.list({ toolkit: "gmail" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let config = (list.items ?? []).find((a: any) => a.name === CONFIG_NAME);
    if (!config) {
      config = await composio.authConfigs.create("gmail", {
        type: "use_composio_managed_auth",
        name: CONFIG_NAME,
      });
      console.log("Auth config Gmail creata:", config.id);
    } else {
      console.log("Auth config Gmail esistente:", config.id);
    }
    for (const m of MAILBOXES) {
      try {
        const req = await composio.connectedAccounts.link(userId, config.id, { alias: m.alias, allowMultiple: true });
        console.log(`\nLink per ${m.email} (alias ${m.alias}):\n${req.redirectUrl}`);
      } catch (e) {
        console.log(`\nLink per ${m.email} non creato: ${safeError(e)}`);
      }
    }
    return;
  }

  if (mode === "check") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts: any = await composio.connectedAccounts.list({ toolkitSlugs: ["gmail"] });
    if (!accounts.items?.length) console.log("Nessun account Gmail collegato.");
    for (const a of accounts.items ?? []) {
      let email = "?";
      if (a.status === "ACTIVE") {
        try {
          const r = await composio.tools.execute("GMAIL_GET_PROFILE", {
            userId: a.userId ?? a.user_id ?? userId,
            connectedAccountId: a.id,
            arguments: { user_id: "me" },
            dangerouslySkipVersionCheck: true,
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = r.data as any;
          email = d?.emailAddress ?? d?.response_data?.emailAddress ?? d?.email_address ?? "?";
        } catch (e) {
          email = `errore ${safeError(e)}`;
        }
      }
      console.log(`- id=${a.id} alias=${a.alias ?? "-"} status=${a.status} email=${email}`);
    }
    return;
  }

  console.log("Uso: npx tsx scripts/gmail-connect.ts link|check");
}

main().catch((e) => {
  console.error("Errore:", safeError(e));
  process.exit(1);
});
