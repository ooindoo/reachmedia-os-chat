/**
 * Telegram HTML: dynamic texts with &, <, >, quotes never break a message.
 *   npx tsx scripts/test-telegram-html.ts
 * No network, no env.
 */
import assert from "node:assert/strict";
import { esc, link, messageToHtml } from "../lib/bot/telegram";
import { emailSection, attesa, stripQuoted, matchClient, matchClients, resolveClient, type PendingMail } from "../lib/bot/email-check";
import { markDoneInMessage } from "../lib/bot/briefing";
import { parseClientEmails } from "../lib/bot/notion";
import { isInvite, parseAddresses, parseThreadLink, threadLink } from "../lib/bot/gmail";

/** Accepts only what the bot sends: text, &amp;/&lt;/&gt;/&quot; and <a href="…">…</a>. */
function validTelegramHtml(html: string): boolean {
  const noLinks = html.replace(/<a href="[^"<>]*">([^<>]*)<\/a>/g, "$1");
  if (/[<>]/.test(noLinks)) return false;
  return !/&(?!(amp|lt|gt|quot);)/.test(noLinks);
}

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

test("esc", () => {
  assert.equal(esc(`Shirò & Co <b>"x"</b>`), "Shirò &amp; Co &lt;b&gt;&quot;x&quot;&lt;/b&gt;");
  assert.equal(esc(null), "");
});

test("link escapes url and label", () => {
  const l = link("https://x.it/?a=1&b=<2>", "R&D <bozza>");
  assert.equal(l, `<a href="https://x.it/?a=1&amp;b=&lt;2&gt;">R&amp;D &lt;bozza&gt;</a>`);
  assert.ok(validTelegramHtml(l));
});

const now = Date.UTC(2026, 10, 23, 12, 0);
const nasty: PendingMail[] = [
  {
    mailbox: "arditnwork", threadId: "18c2f0a1b2c3d4e5", cliente: "Shirò Pagani & Co", mittente: "Anna <Rossi>",
    riassunto: `prezzi "A&B" < 100€ > ok?`, ricevuta: now - 3 * 3_600_000,
    link: threadLink("arditnwork", "18c2f0a1b2c3d4e5"), bozza: true, nuova: true, inCc: false,
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    mailbox: "agency" as const, threadId: `abc${i}`, cliente: "Luxyt", mittente: "Luxyt",
    riassunto: `richiesta ${i}`, ricevuta: now - (i + 1) * 86_400_000, link: threadLink("agency", `abc${i}`),
    bozza: false, nuova: false, inCc: false,
  })),
];

test("emailSection: escaped, valid, max 5 lines + 'e altre N'", () => {
  const lines = emailSection(nasty, "📧 Da rispondere", now);
  const html = lines.join("\n");
  assert.ok(validTelegramHtml(html), html);
  assert.equal(lines[0], "📧 Da rispondere");
  assert.equal(lines.length, 1 + 5 + 1);
  assert.equal(lines[6], "e altre 2");
  assert.ok(lines[1].includes("Shirò Pagani &amp; Co (Anna &lt;Rossi&gt;)"));
  assert.ok(lines[1].includes("prezzi &quot;A&amp;B&quot; &lt; 100€ &gt; ok?"));
  assert.ok(lines[1].includes("da 3 ore"));
  assert.ok(lines[1].includes(`<a href="https://mail.google.com/mail/u/arditnwork@gmail.com/#all/18c2f0a1b2c3d4e5">apri bozza</a>`));
  assert.ok(lines[2].startsWith("• Luxyt: richiesta 0 · da 1 giorno · "), lines[2]);
  assert.ok(lines[2].includes(">apri mail</a>"));
});

test("attesa", () => {
  assert.equal(attesa(5 * 60_000), "da 5 min");
  assert.equal(attesa(60 * 60_000), "da 1 ora");
  assert.equal(attesa(49 * 3_600_000), "da 2 giorni");
});

test("messageToHtml rebuilds links with UTF-16 offsets (emoji before the link)", () => {
  const text = "☀️ Buongiorno!\n1. A&B <x>\n📧 Da rispondere\n• Luxyt: ciao · apri bozza";
  const offset = text.indexOf("apri bozza");
  const html = messageToHtml({
    text,
    entities: [{ type: "text_link", offset, length: "apri bozza".length, url: "https://mail.google.com/mail/u/x/#all/1?a=1&b=2" }],
  });
  assert.ok(validTelegramHtml(html), html);
  assert.ok(html.includes("1. A&amp;B &lt;x&gt;"));
  assert.ok(html.endsWith(`<a href="https://mail.google.com/mail/u/x/#all/1?a=1&amp;b=2">apri bozza</a>`), html);
});

test("markDoneInMessage on HTML keeps it valid", () => {
  const html = `☀️ Buongiorno!\n\n🎯 Le 3 cose di oggi\n1. 10:00 R&amp;D &lt;test&gt; — Lavoro clienti\n2. Altro\n\n📧 Da rispondere\n• X: y · da 1 ora · <a href="https://a.it/?q=1&amp;r=2">apri bozza</a>`;
  const kb = [[{ text: "✅ Fatto 1. R&D", callback_data: "f:abc:1" }], [{ text: "✅ Fatto 2. Altro", callback_data: "f:def:2" }]];
  const next = markDoneInMessage(html, kb, 1);
  assert.ok(validTelegramHtml(next.text), next.text);
  assert.ok(next.text.includes("1. ✅ 10:00 R&amp;D &lt;test&gt; — Lavoro clienti (fatto)"));
  assert.equal(next.keyboard.length, 1);
});

test("validator catches broken HTML", () => {
  assert.equal(validTelegramHtml("A & B"), false);
  assert.equal(validTelegramHtml("a < b"), false);
  assert.equal(validTelegramHtml("A &amp; B"), true);
});

test("client emails and matching", () => {
  assert.deepEqual(parseClientEmails("Mario@Seventy.it, @luxyt.com; anna.rossi@gmail.com x"), ["mario@seventy.it", "luxyt.com", "anna.rossi@gmail.com"]);
  const clients = [
    { id: "1", nome: "Luxyt", tipo: null, email: ["luxyt.com"] },
    { id: "2", nome: "Seventy", tipo: null, email: ["mario@seventy.it", "gmail.com"] },
  ];
  assert.equal(matchClient("ceo@luxyt.com", clients)?.nome, "Luxyt");
  assert.equal(matchClient("x@mail.luxyt.com", clients)?.nome, "Luxyt");
  assert.equal(matchClient("mario@seventy.it", clients)?.nome, "Seventy");
  assert.equal(matchClient("altro@seventy.it", clients), null);
  assert.equal(matchClient("chiunque@gmail.com", clients), null); // public domain never matches as a domain
});

test("shared sender (iStudios): the client named in the mail, else no client", () => {
  const clients = [
    { id: "1", nome: "Seventy Venezia", tipo: null, email: ["cadamosto.com", "istudios.it"] },
    { id: "2", nome: "Shirò Pagani Boutique", tipo: null, email: ["istudios.it"] },
    { id: "3", nome: "Squale SA", tipo: null, email: ["squale.ch", "istudios.it"] },
  ];
  assert.equal(matchClients("alma@istudios.it", clients).length, 3);
  const r1 = resolveClient("alma@istudios.it", clients, { subject: "Newsletter Shiro dicembre", text: "" })!;
  assert.deepEqual([r1.nome, r1.clienti.map((c) => c.id)], ["Shirò Pagani Boutique", ["2"]]);
  const r2 = resolveClient("alma@istudios.it", clients, { subject: "Aggiornamento", text: "per Seventy serve..." })!;
  assert.deepEqual([r2.nome, r2.clienti.map((c) => c.id)], ["Seventy Venezia", ["1"]]);
  const r3 = resolveClient("alma@istudios.it", clients, { subject: "Fattura", text: "ciao" })!;
  assert.deepEqual([r3.nome, r3.clienti.length], ["iStudios", 0]);
  const r4 = resolveClient("info@istudios.it", clients, { subject: "Squale e Seventy", text: "" })!;
  assert.deepEqual([r4.nome, r4.clienti.length], ["iStudios", 0]); // two named: no client
  const r5 = resolveClient("alma@istudios.it", clients, { subject: "Re: ok", text: "va bene\n\nIl giorno lun Ardit ha scritto:\n> Squale" })!;
  assert.equal(r5.nome, "iStudios"); // a name only in the quoted reply does not count
  assert.deepEqual(resolveClient("sofia@cadamosto.com", clients, { subject: "", text: "" })!.clienti.map((c) => c.id), ["1"]);
  assert.equal(resolveClient("x@altro.it", clients, { subject: "", text: "" }), null);
});

test("meeting invitations", () => {
  const base = { subject: "Aggiornamento", text: "ciao", parts: [] as { mimeType?: string; filename?: string }[] };
  assert.equal(isInvite(base), false);
  assert.equal(isInvite({ ...base, parts: [{ mimeType: "text/calendar; method=REQUEST" }] }), true);
  assert.equal(isInvite({ ...base, parts: [{ mimeType: "application/octet-stream", filename: "invite.ics" }] }), true);
  assert.equal(isInvite({ ...base, subject: "Invito: Allineamento @ lun 24 nov" }), true);
  assert.equal(isInvite({ ...base, subject: "Invitation: Weekly sync" }), true);
  assert.equal(isInvite({ ...base, text: "Partecipa: https://teams.microsoft.com/l/meetup-join/19%3a..." }), true);
  assert.equal(isInvite({ ...base, text: "link https://meet.google.com/abc-defg-hij" }), true);
  assert.equal(isInvite({ ...base, text: "https://us02web.zoom.us/j/123456" }), true);
  assert.equal(isInvite({ ...base, contentClass: "urn:content-classes:calendarmessage" }), true);
  assert.equal(isInvite({ ...base, subject: "Re: invito alla presentazione" }), false);
});

test("addresses, thread links, quoted text", () => {
  assert.deepEqual(parseAddresses(`"Rossi, Anna" <Anna@X.it>, b@y.com`), [
    { name: "Rossi, Anna", email: "anna@x.it" }, { name: "", email: "b@y.com" },
  ]);
  assert.deepEqual(parseThreadLink(threadLink("agency", "18c2f0a1")), { mailbox: "agency", threadId: "18c2f0a1" });
  assert.equal(parseThreadLink("https://mail.google.com/mail/u/0/#inbox/18c2f0a1"), null);
  assert.equal(stripQuoted("Ciao,\nva bene.\n\nIl giorno lun 23 nov 2026 Ardit ha scritto:\n> vecchio"), "Ciao,\nva bene.");
});

console.log(`\n${passed} test ok`);
