/**
 * Gmail through Composio: two mailboxes, read and drafts only.
 *
 * Safety:
 *  - only the 4 tools below can be called (no send, no delete, no labels)
 *  - each mailbox has its own connected account; before using it the code
 *    checks that the account really is that address, so a Luxyt draft can
 *    never end up on arditnwork or the other way round
 *  - the Composio-managed connection has full Gmail access (Google blocks a
 *    narrower custom app as unverified): this file is the only limit
 */
import { Composio } from "@composio/core";
import { GMAIL_TOOLKIT_VERSION, MAILBOXES, type Mailbox } from "./config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const ALLOWED_TOOLS = new Set([
  "GMAIL_GET_PROFILE",
  "GMAIL_FETCH_EMAILS",
  "GMAIL_FETCH_MESSAGE_BY_THREAD_ID",
  "GMAIL_CREATE_EMAIL_DRAFT",
]);

let client: Composio | null = null;
function composio(): Composio {
  if (!client) {
    client = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
      toolkitVersions: { gmail: GMAIL_TOOLKIT_VERSION },
    });
  }
  return client;
}

/** True when the mailbox has a connected account configured. */
export function mailboxConfigured(mb: Mailbox): boolean {
  return Boolean(process.env[MAILBOXES[mb].accountEnv]);
}

async function exec(mb: Mailbox, slug: string, args: AnyRecord): Promise<AnyRecord> {
  if (!ALLOWED_TOOLS.has(slug)) throw new Error(`Tool Gmail non consentito: ${slug}`);
  const userId = process.env.COMPOSIO_USER_ID;
  const accountId = process.env[MAILBOXES[mb].accountEnv];
  if (!userId) throw new Error("Variabile d'ambiente mancante: COMPOSIO_USER_ID");
  if (!accountId) throw new Error(`Variabile d'ambiente mancante: ${MAILBOXES[mb].accountEnv}`);
  const res = await composio().tools.execute(slug, {
    userId,
    connectedAccountId: accountId,
    arguments: { user_id: "me", ...args },
  });
  if (!res.successful) throw new Error(`${slug}: ${res.error ?? "errore sconosciuto"}`);
  return (res.data ?? {}) as AnyRecord;
}

// ── Mailbox check ─────────────────────────────────────────────────────────────

const verified = new Map<Mailbox, number>();
const VERIFY_TTL_MS = 10 * 60 * 1000;

/** Throws unless the connected account is exactly the expected address. */
export async function verifyMailbox(mb: Mailbox): Promise<void> {
  const at = verified.get(mb);
  if (at && Date.now() - at < VERIFY_TTL_MS) return;
  const d = await exec(mb, "GMAIL_GET_PROFILE", {});
  const email = String(d.emailAddress ?? d.response_data?.emailAddress ?? d.email_address ?? "").toLowerCase();
  if (email !== MAILBOXES[mb].email) {
    throw new Error(`la casella collegata come ${MAILBOXES[mb].email} risulta "${email || "?"}": controllo saltato`);
  }
  verified.set(mb, Date.now());
}

// ── Reading ───────────────────────────────────────────────────────────────────

/** Thread IDs of the messages matching a Gmail search query. */
export async function searchThreadIds(mb: Mailbox, query: string, max = 500): Promise<string[]> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  do {
    const d = await exec(mb, "GMAIL_FETCH_EMAILS", {
      query, ids_only: true, max_results: 100, include_spam_trash: false,
      ...(pageToken ? { page_token: pageToken } : {}),
    });
    const msgs: AnyRecord[] = d.messages ?? d.response_data?.messages ?? [];
    for (const m of msgs) {
      const t = m.threadId ?? m.thread_id;
      if (t) ids.add(String(t));
    }
    pageToken = d.nextPageToken ?? d.next_page_token ?? undefined;
  } while (pageToken && ids.size < max);
  return Array.from(ids);
}

export interface MailAddress { name: string; email: string }

export interface MailMessage {
  id: string;
  threadId: string;
  /** Milliseconds since epoch. */
  time: number;
  labels: string[];
  from: MailAddress | null;
  replyTo: MailAddress | null;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  text: string;
  /** Mailing list / newsletter / auto-reply headers. */
  automated: boolean;
  /** Meeting invitation: calendar part or .ics, invite subject, Teams/Meet/Zoom join link. */
  invite: boolean;
}

/** Splits an address header ("Name <a@b.c>, d@e.f") into name + lowercase email. */
export function parseAddresses(header: string | undefined | null): MailAddress[] {
  if (!header) return [];
  const out: MailAddress[] = [];
  // Split on commas outside quotes and angle brackets.
  const parts: string[] = [];
  let cur = "";
  let quote = false;
  let angle = false;
  for (const ch of header) {
    if (ch === '"') quote = !quote;
    if (ch === "<") angle = true;
    if (ch === ">") angle = false;
    if (ch === "," && !quote && !angle) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  for (const p of parts) {
    const m = p.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    const email = (m ? m[2] : p).trim().toLowerCase();
    if (!email.includes("@")) continue;
    out.push({ name: (m ? m[1] : "").trim(), email });
  }
  return out;
}

function headerMap(m: AnyRecord): Map<string, string> {
  const map = new Map<string, string>();
  const headers: AnyRecord[] = m.payload?.headers ?? m.headers ?? [];
  for (const h of headers) {
    if (h?.name) map.set(String(h.name).toLowerCase(), String(h.value ?? ""));
  }
  return map;
}

function decodeBase64Url(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/** Plain text of a Gmail payload: text/plain parts first, else stripped HTML. */
function payloadText(payload: AnyRecord | undefined): string {
  if (!payload) return "";
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (p: AnyRecord) => {
    const data = p.body?.data;
    if (data && p.mimeType === "text/plain") plain.push(decodeBase64Url(data));
    else if (data && p.mimeType === "text/html") html.push(decodeBase64Url(data));
    for (const c of p.parts ?? []) walk(c);
  };
  walk(payload);
  if (plain.length) return plain.join("\n");
  return html
    .join("\n")
    .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const INVITE_SUBJECT = /^\s*(invito( aggiornato)?|invitation|updated invitation|accettato|accepted|rifiutato|declined|annullato|evento annullato|canceled|cancelled|new event|nuovo evento)\s*:/i;
const MEETING_LINK = /(teams\.microsoft\.com\/l\/meetup-join|teams\.live\.com\/meet\/|meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}|[a-z0-9.-]*zoom\.us\/(j|my|w)\/)/i;

/** Calendar invitation: text/calendar or .ics part, invite subject, or a Teams/Meet/Zoom join link. */
export function isInvite(m: { subject: string; text: string; parts: { mimeType?: string; filename?: string }[]; contentClass?: string }): boolean {
  if (/calendarmessage/i.test(m.contentClass ?? "")) return true;
  if (m.parts.some((p) => /^(text\/calendar|application\/ics)/i.test(p.mimeType ?? "") || /\.ics$/i.test(p.filename ?? ""))) return true;
  return INVITE_SUBJECT.test(m.subject) || MEETING_LINK.test(m.text);
}

function allParts(m: AnyRecord): { mimeType?: string; filename?: string }[] {
  const out: { mimeType?: string; filename?: string }[] = [];
  const walk = (p: AnyRecord | undefined) => {
    if (!p) return;
    out.push({ mimeType: p.mimeType, filename: p.filename });
    for (const c of p.parts ?? []) walk(c);
  };
  walk(m.payload);
  for (const a of m.attachmentList ?? []) out.push({ mimeType: a.mimeType ?? a.mime_type, filename: a.filename ?? a.name });
  return out;
}

function toMessage(m: AnyRecord, threadId: string): MailMessage {
  const h = headerMap(m);
  const from = parseAddresses(h.get("from") ?? m.sender)[0] ?? null;
  const ts = Number(m.internalDate ?? 0) || Date.parse(m.messageTimestamp ?? h.get("date") ?? "") || 0;
  const precedence = (h.get("precedence") ?? "").toLowerCase();
  const autoSubmitted = (h.get("auto-submitted") ?? "no").toLowerCase();
  const fromEmail = from?.email ?? "";
  const automated =
    h.has("list-unsubscribe") || h.has("list-id") ||
    ["bulk", "list", "junk"].includes(precedence) ||
    autoSubmitted !== "no" ||
    /^(no-?reply|do-?not-?reply|notifications?|mailer-daemon|postmaster|bounce)/.test(fromEmail);
  const subject = String(h.get("subject") ?? m.subject ?? "");
  const text = String(m.messageText ?? "") || payloadText(m.payload) || String(m.preview?.body ?? m.snippet ?? "");
  return {
    id: String(m.messageId ?? m.id ?? ""),
    threadId: String(m.threadId ?? threadId),
    time: ts,
    labels: (m.labelIds ?? []).map(String),
    from,
    replyTo: parseAddresses(h.get("reply-to"))[0] ?? null,
    to: parseAddresses(h.get("to") ?? m.to),
    cc: parseAddresses(h.get("cc")),
    subject,
    text,
    automated,
    invite: isInvite({ subject, text, parts: allParts(m), contentClass: h.get("content-class") }),
  };
}

/** All messages of a thread (drafts included, flagged by the DRAFT label), oldest first. */
export async function getThread(mb: Mailbox, threadId: string): Promise<MailMessage[]> {
  const out: MailMessage[] = [];
  let pageToken: string | undefined;
  do {
    const d = await exec(mb, "GMAIL_FETCH_MESSAGE_BY_THREAD_ID", {
      thread_id: threadId, ...(pageToken ? { page_token: pageToken } : {}),
    });
    const msgs: AnyRecord[] = d.messages ?? d.response_data?.messages ?? d.thread?.messages ?? [];
    for (const m of msgs) out.push(toMessage(m, threadId));
    pageToken = d.nextPageToken ?? d.next_page_token ?? undefined;
  } while (pageToken);
  return out.sort((a, b) => a.time - b.time);
}

/** Headers only (no bodies) of the messages matching a query, newest first. */
export async function listMessageHeaders(mb: Mailbox, query: string, max = 1000): Promise<MailMessage[]> {
  const out: MailMessage[] = [];
  let pageToken: string | undefined;
  do {
    const d = await exec(mb, "GMAIL_FETCH_EMAILS", {
      query, verbose: false, include_payload: false, max_results: 100, include_spam_trash: false,
      ...(pageToken ? { page_token: pageToken } : {}),
    });
    const msgs: AnyRecord[] = d.messages ?? d.response_data?.messages ?? [];
    for (const m of msgs) out.push(toMessage(m, String(m.threadId ?? "")));
    pageToken = d.nextPageToken ?? d.next_page_token ?? undefined;
  } while (pageToken && out.length < max);
  return out;
}

// ── Drafts ────────────────────────────────────────────────────────────────────

/**
 * Creates a reply draft inside the thread (empty subject keeps it there).
 * Composio silently makes a new thread when it can't use the given one:
 * the result says whether the draft really landed in the thread.
 */
export async function createReplyDraft(
  mb: Mailbox, d: { threadId: string; to: string; body: string }
): Promise<{ draftId: string; inThread: boolean }> {
  const res = await exec(mb, "GMAIL_CREATE_EMAIL_DRAFT", {
    thread_id: d.threadId,
    recipient_email: d.to,
    body: d.body,
    is_html: false,
    timezone: "Europe/Rome",
    include_signature: true,
  });
  const r = res.response_data ?? res.draft ?? res;
  const draftId = String(r.id ?? r.draft_id ?? "");
  const threadOf = String(r.message?.threadId ?? r.message?.thread_id ?? r.threadId ?? r.thread_id ?? "");
  return { draftId, inThread: threadOf === d.threadId };
}

/** Opens the thread (with the draft at the bottom) in the right Gmail account. */
export function threadLink(mb: Mailbox, threadId: string): string {
  return `https://mail.google.com/mail/u/${MAILBOXES[mb].email}/#all/${threadId}`;
}

/** Reverse of threadLink: only links in that exact format, for the two mailboxes. */
export function parseThreadLink(url: string | null | undefined): { mailbox: Mailbox; threadId: string } | null {
  const m = (url ?? "").match(/^https:\/\/mail\.google\.com\/mail\/u\/([^/]+)\/#all\/([0-9a-f]+)$/i);
  if (!m) return null;
  const email = decodeURIComponent(m[1]).toLowerCase();
  const mailbox = (Object.keys(MAILBOXES) as Mailbox[]).find((k) => MAILBOXES[k].email === email);
  return mailbox ? { mailbox, threadId: m[2] } : null;
}
