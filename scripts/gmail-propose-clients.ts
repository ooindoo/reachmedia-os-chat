/**
 * Proposes the "Email" field of each active client from the last 6 months of
 * mail: addresses I exchanged messages with (received from AND sent to) whose
 * address or name looks like the client. Read-only: writes nothing.
 *
 *   npx tsx scripts/gmail-propose-clients.ts
 *
 * Luxyt is looked up only on email.ma.agency, every other client only on arditnwork.
 * Output also saved as JSON next to the script output path given as argv[2] (optional).
 */
import { writeFileSync } from "node:fs";
import { MAILBOXES, MAILBOX_KEYS, mailboxForClient, type Mailbox } from "../lib/bot/config";
import { listMessageHeaders, mailboxConfigured, verifyMailbox } from "../lib/bot/gmail";
import { getActiveClients } from "../lib/bot/notion";

process.loadEnvFile(".env.local");

const PUBLIC = /^(gmail|googlemail|outlook|hotmail|live|msn|yahoo|icloud|me|mac|libero|virgilio|tiscali|alice|tim|fastwebnet|aol|proton|protonmail|gmx|email|mail|inwind|iol)\.[a-z.]+$/;
const STOP = new Set(["shop", "store", "boutique", "agency", "venezia", "milano", "roma", "airbnb", "the", "srl", "spa", "sa"]);

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** "CappellettoShop" → cappelletto; "Markershop" → marker; "Squale SA" → squale. */
function tokens(nome: string): string[] {
  const parts = nome.replace(/\(.*?\)/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").split(/[^A-Za-zÀ-ÿ0-9]+/);
  const out = new Set<string>();
  for (const p of parts.map(norm)) {
    if (!p) continue;
    const stem = p.replace(/(shop|store|boutique)$/, "");
    for (const t of [p, stem]) if (t.length >= 4 && !STOP.has(t)) out.add(t);
  }
  return Array.from(out);
}

interface Corr { email: string; names: Set<string>; ricevute: number; inviate: number; ultimo: number }

async function main() {
  const clients = await getActiveClients(true);
  const result: Record<string, { casella: string; proposte: { voce: string; ricevute: number; inviate: number; nomi: string[] }[] }> = {};
  const altri: Record<string, { email: string; ricevute: number; inviate: number; nomi: string[] }[]> = {};

  for (const mb of MAILBOX_KEYS as Mailbox[]) {
    if (!mailboxConfigured(mb)) {
      console.log(`(${MAILBOXES[mb].email} non collegata: saltata)`);
      continue;
    }
    await verifyMailbox(mb);
    const me = MAILBOXES[mb].email;
    const msgs = await listMessageHeaders(mb, "newer_than:180d -in:chats", 4000);
    console.log(`${me}: ${msgs.length} messaggi letti (solo intestazioni)`);

    const corr = new Map<string, Corr>();
    const add = (email: string, name: string, dir: "in" | "out", time: number) => {
      if (!email || email === me || /^(no-?reply|do-?not-?reply|notifications?|mailer-daemon)/.test(email)) return;
      const c = corr.get(email) ?? { email, names: new Set<string>(), ricevute: 0, inviate: 0, ultimo: 0 };
      if (name) c.names.add(name);
      if (dir === "in") c.ricevute++;
      else c.inviate++;
      c.ultimo = Math.max(c.ultimo, time);
      corr.set(email, c);
    };
    for (const m of msgs) {
      const mine = m.labels.includes("SENT") || m.from?.email === me;
      if (mine) for (const a of [...m.to, ...m.cc]) add(a.email, a.name, "out", m.time);
      else if (m.from) add(m.from.email, m.from.name, "in", m.time);
    }
    const scambiati = Array.from(corr.values()).filter((c) => c.ricevute > 0 && c.inviate > 0);
    const usati = new Set<string>();

    for (const cl of clients.filter((c) => mailboxForClient(c.nome) === mb)) {
      const tk = tokens(cl.nome);
      const hits = scambiati.filter((c) => {
        const hay = norm(`${c.email} ${Array.from(c.names).join(" ")}`);
        return tk.some((t) => hay.includes(t));
      });
      // Group by company domain (not for free providers): one "@domain" entry.
      const byEntry = new Map<string, { voce: string; ricevute: number; inviate: number; nomi: Set<string> }>();
      for (const h of hits) {
        usati.add(h.email);
        const domain = h.email.split("@")[1];
        const domainLooksLikeClient = !PUBLIC.test(domain) && tk.some((t) => norm(domain).includes(t));
        const voce = domainLooksLikeClient ? `@${domain}` : h.email;
        const e = byEntry.get(voce) ?? { voce, ricevute: 0, inviate: 0, nomi: new Set<string>() };
        e.ricevute += h.ricevute;
        e.inviate += h.inviate;
        h.names.forEach((n) => e.nomi.add(n));
        byEntry.set(voce, e);
      }
      result[cl.nome] = {
        casella: me,
        proposte: Array.from(byEntry.values())
          .sort((a, b) => b.ricevute + b.inviate - (a.ricevute + a.inviate))
          .map((e) => ({ voce: e.voce, ricevute: e.ricevute, inviate: e.inviate, nomi: Array.from(e.nomi).slice(0, 3) })),
      };
    }
    altri[me] = scambiati
      .filter((c) => !usati.has(c.email))
      .sort((a, b) => b.ricevute + b.inviate - (a.ricevute + a.inviate))
      .slice(0, 15)
      .map((c) => ({ email: c.email, ricevute: c.ricevute, inviate: c.inviate, nomi: Array.from(c.names).slice(0, 2) }));
  }

  for (const [nome, r] of Object.entries(result)) {
    console.log(`\n${nome} (${r.casella})`);
    if (!r.proposte.length) console.log("  nessuna proposta");
    for (const p of r.proposte) console.log(`  ${p.voce}  · ricevute ${p.ricevute}, inviate ${p.inviate}${p.nomi.length ? ` · ${p.nomi.join(", ")}` : ""}`);
  }
  for (const [casella, list] of Object.entries(altri)) {
    console.log(`\nAltri con cui hai scambiato mail su ${casella} (non assegnati):`);
    for (const c of list) console.log(`  ${c.email}  · ricevute ${c.ricevute}, inviate ${c.inviate}${c.nomi.length ? ` · ${c.nomi.join(", ")}` : ""}`);
  }
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify({ result, altri }, null, 2));
}

main().catch((e) => {
  console.error("Errore:", e?.message ?? e);
  process.exit(1);
});
