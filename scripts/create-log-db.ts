/**
 * One-off: creates the "🤖 Bot Log" database next to the Task database
 * (same parent page, so the integration already has access).
 * Prints the data source ID to put in NOTION_LOG_DB.
 *
 *   npx tsx scripts/create-log-db.ts
 */
import { Client } from "@notionhq/client";

process.loadEnvFile(".env.local");

const PARENT_PAGE_ID = "3776285e-c206-814c-9b7c-e7f102f30710"; // parent of Task + Clienti

async function main() {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: PARENT_PAGE_ID },
    title: [{ type: "text", text: { content: "Bot Log" } }],
    icon: { type: "emoji", emoji: "🤖" },
    initial_data_source: {
      properties: {
        Messaggio: { title: {} },
        Ricevuto: { created_time: {} },
        "Update ID": { number: {} },
        Stato: {
          select: {
            options: [
              { name: "✅ Ok", color: "green" },
              { name: "❌ Errore", color: "red" },
              { name: "⏳ Attesa ora", color: "yellow" },
              { name: "⌨️ Attesa ora scritta", color: "orange" },
              { name: "↩️ Annullato", color: "gray" },
              { name: "ℹ️ Nessuna azione", color: "blue" },
            ],
          },
        },
        "Event ID": { rich_text: {} },
        Calendario: { rich_text: {} },
        "Notion Task": { url: {} },
        Risposta: { rich_text: {} },
        Azioni: { rich_text: {} },
        Bozza: { rich_text: {} },
        Errore: { rich_text: {} },
      },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ds = (db as any).data_sources?.[0]?.id;
  console.log("Database:", db.id);
  console.log("NOTION_LOG_DB (data source):", ds);
}

main().catch((e) => {
  console.error("Errore:", e?.code ?? e?.name, e?.status ?? "");
  process.exit(1);
});
