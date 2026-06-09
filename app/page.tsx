"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ChatMessage from "@/components/ChatMessage";
import type { TaskData } from "@/lib/notion";
import type { InvoiceData } from "@/lib/invoice";
import type { TimeLogData } from "@/lib/timelog";
import type { TaskSearchResult, TaskUpdate } from "@/lib/update-task";
import type { InvoiceSearchResult, InvoiceUpdate } from "@/lib/invoice-update";
import { saveReminder, scheduleReminder, bootstrapReminders, checkDueReminders } from "@/lib/reminders";

// ── Google Calendar icon — SVG, no white background (dark-mode safe) ──────────
function GCalIcon({ size = 20, dim = false }: { size?: number; dim?: boolean }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: dim ? 0.4 : 1, flexShrink: 0, display: "block" }}
    >
      {/* Card outline — subtle on dark bg */}
      <rect x="1" y="2" width="18" height="16" rx="2" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" fill="rgba(255,255,255,0.04)"/>
      {/* Blue header bar */}
      <rect x="1" y="2" width="18" height="5.5" rx="2" fill="#1a73e8"/>
      <rect x="1" y="5" width="18" height="2.5" fill="#1a73e8"/>
      {/* Hinge pegs */}
      <rect x="6.5" y="0.5" width="1.5" height="3.5" rx="0.75" fill="#1a73e8"/>
      <rect x="12" y="0.5" width="1.5" height="3.5" rx="0.75" fill="#1a73e8"/>
      {/* Day "31" */}
      <text x="10" y="15.5" textAnchor="middle" fontFamily="Roboto,Arial,sans-serif" fontSize="7" fontWeight="700" fill="#1a73e8">31</text>
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
export type PendingAction =
  | { type: "create_task"; data: TaskData }
  | { type: "create_invoice"; data: InvoiceData }
  | { type: "create_timelog"; data: TimeLogData }
  | { type: "select_task"; tasks: TaskSearchResult[]; updates: TaskUpdate }
  | { type: "confirm_update"; task: TaskSearchResult; updates: TaskUpdate }
  | { type: "select_invoice"; invoices: InvoiceSearchResult[]; updates: InvoiceUpdate }
  | { type: "confirm_update_invoice"; invoice: InvoiceSearchResult; updates: InvoiceUpdate };

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: PendingAction;
  notionUrl?: string;
}

const ALL_EXAMPLES = [
  "chiama Squale venerdì",
  "newsletter CappellettoShop lunedì",
  "fattura Luxyt 1200€ giugno",
  "3h su NOESI analytics oggi",
  "fix bug Shopify Markershop",
  "report campagne Squale entro giovedì",
  "call con Shirò Pagani domani alle 15",
  "segna fatto newsletter CappellettoShop",
  "fattura Opplant 800€ maggio pagata",
  "2h su Stewart Dawson oggi",
  "flow welcome NOESI entro venerdì",
  "segna urgente report Luxyt",
  "chiama Giuseppe Toniolo lunedì",
  "aggiorna task Sicura in corso",
  "newsletter Squale SUB-37 mercoledì",
  "1h su Markershop badge design oggi",
  "aggiorna stato flow Luxyt",
  "chiama Ilse di Squale giovedì",
  "fix metafield Shirò Pagani domani",
  "fattura Stewart Dawson pagata",
  "report open rate NOESI venerdì",
  "2h copy newsletter Squale oggi",
  "chiama Alex Pontin lunedì mattina",
  "segna fatto audit Opplant",
];

// Shuffle once per page load, show 4 random
const EXAMPLES = [...ALL_EXAMPLES]
  .sort(() => Math.random() - 0.5)
  .slice(0, 4);

async function sendNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/apple-icon" });
  }
}

const uid = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

// ── Shared input/button helpers ────────────────────────────────────────────────
function SendButton({ loading, onClick, disabled }: { loading: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Invia"
      className="rm-send shrink-0 bg-rm-accent text-black font-black hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {/* Mobile: arrow 44×44 touch target */}
      <span className="flex sm:hidden items-center justify-center w-11 h-11 text-xl leading-none">
        {loading ? "…" : "→"}
      </span>
      {/* Desktop: INVIA — padding 10px 20px as spec */}
      <span className="hidden sm:flex items-center text-[11px] font-black uppercase tracking-[0.08em] px-5 py-[10px]">
        {loading ? "…" : "INVIA"}
      </span>
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { data: session, status: sessionStatus } = useSession();
  // gcalConnected = has a valid token AND the granted scope includes calendar.events
  const gcalConnected =
    sessionStatus === "authenticated" &&
    !!session?.accessToken &&
    !session?.error &&
    !!(session?.scope ?? "").includes("calendar");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    try {
      if (localStorage.getItem("rm-notifications") === "true") setNotificationsOn(true);
    } catch { /* noop */ }

    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    // Guard: Notification API not available on iOS < 16.4 and some webviews
    const notifOk = typeof Notification !== "undefined" && Notification.permission === "granted";
    if (notifOk) bootstrapReminders();

    const poll = setInterval(() => {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") checkDueReminders();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && typeof Notification !== "undefined" && Notification.permission === "granted") checkDueReminders();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(poll); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (ev: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(ev.target.value);
    ev.target.style.height = "auto";
    ev.target.style.height = Math.min(ev.target.scrollHeight, 160) + "px";
  };

  const patchMsg = (id: string, patch: Partial<Message>) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const toggleNotifications = async () => {
    if (!notificationsOn) {
      if (typeof window !== "undefined" && "Notification" in window) {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
      }
      setNotificationsOn(true);
      localStorage.setItem("rm-notifications", "true");
    } else {
      setNotificationsOn(false);
      localStorage.setItem("rm-notifications", "false");
    }
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setMessages((prev) => [...prev, { id: uid(), role: "user", content: userText }]);
    setLoading(true);
    const thinkingId = uid();
    setMessages((prev) => [...prev, { id: thinkingId, role: "assistant", content: "—" }]);

    try {
      const parseRes = await fetch("/api/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });
      const parsed = await parseRes.json();
      if (!parseRes.ok) { patchMsg(thinkingId, { content: `❌ ${parsed.error ?? "Errore"}` }); return; }

      if (parsed.intent === "create_task") {
        patchMsg(thinkingId, { content: "Ecco la task estratta — modifica e conferma:", pending: { type: "create_task", data: parsed.data } });
      } else if (parsed.intent === "create_invoice") {
        patchMsg(thinkingId, { content: "Fattura estratta — modifica e conferma:", pending: { type: "create_invoice", data: parsed.data } });
      } else if (parsed.intent === "create_timelog") {
        patchMsg(thinkingId, { content: "Sessione estratta — modifica e conferma:", pending: { type: "create_timelog", data: parsed.data } });
      } else if (parsed.intent === "update_task") {
        // If Claude identified the exact page from context, skip the search
        if (parsed.notionPageId) {
          const task: TaskSearchResult = {
            id: parsed.notionPageId,
            titolo: parsed.titolo || "Task",
            cliente: parsed.cliente || "",
            stato: "", priorita: "", deadline: "",
            url: `https://notion.so/${parsed.notionPageId.replace(/-/g, "")}`,
          };
          patchMsg(thinkingId, { content: "Task trovata — conferma le modifiche:", pending: { type: "confirm_update", task, updates: parsed.updates } });
        } else {
          patchMsg(thinkingId, { content: "Cerco la task…" });
          const sq = encodeURIComponent(parsed.searchQuery || "");
          const cl = encodeURIComponent(parsed.cliente || "");
          const searchRes = await fetch(`/api/search-tasks?q=${sq}&cliente=${cl}`);
          const searchData = await searchRes.json();
          if (!searchRes.ok || !searchData.tasks) { patchMsg(thinkingId, { content: `❌ ${searchData.error ?? "Errore ricerca"}` }); return; }
          const tasks: TaskSearchResult[] = searchData.tasks;
          if (tasks.length === 0) {
            patchMsg(thinkingId, { content: `Nessuna task trovata${parsed.cliente ? " per " + parsed.cliente : ""}.\n\nUsa una parola del titolo esatto in Notion.` });
          } else if (tasks.length === 1) {
            patchMsg(thinkingId, { content: "Task trovata — conferma le modifiche:", pending: { type: "confirm_update", task: tasks[0], updates: parsed.updates } });
          } else {
            patchMsg(thinkingId, { content: `${tasks.length} task trovate — scegli quale aggiornare:`, pending: { type: "select_task", tasks, updates: parsed.updates } });
          }
        }
      } else if (parsed.intent === "update_invoice") {
        // If Claude identified the exact page from context, skip the search
        if (parsed.notionPageId) {
          const invoice: InvoiceSearchResult = {
            id: parsed.notionPageId,
            descrizione: parsed.descrizione || "Fattura",
            cliente: parsed.cliente || "",
            importo: 0,
            statoPagamento: parsed.statoAttuale || "",
            url: `https://notion.so/${parsed.notionPageId.replace(/-/g, "")}`,
          };
          patchMsg(thinkingId, { content: "Fattura trovata — conferma le modifiche:", pending: { type: "confirm_update_invoice", invoice, updates: parsed.updates } });
        } else {
          patchMsg(thinkingId, { content: "Cerco la fattura…" });
          const sq = encodeURIComponent(parsed.searchQuery || "");
          const cl = encodeURIComponent(parsed.cliente || "");
          const searchRes = await fetch(`/api/search-invoices?q=${sq}&cliente=${cl}`);
          const searchData = await searchRes.json();
          if (!searchRes.ok || !searchData.invoices) { patchMsg(thinkingId, { content: `❌ ${searchData.error ?? "Errore ricerca"}` }); return; }
          const invoices: InvoiceSearchResult[] = searchData.invoices;
          if (invoices.length === 0) {
            patchMsg(thinkingId, { content: `Nessuna fattura trovata${parsed.cliente ? " per " + parsed.cliente : ""}.` });
          } else if (invoices.length === 1) {
            patchMsg(thinkingId, { content: "Fattura trovata — conferma le modifiche:", pending: { type: "confirm_update_invoice", invoice: invoices[0], updates: parsed.updates } });
          } else {
            patchMsg(thinkingId, { content: `${invoices.length} fatture trovate — scegli quale aggiornare:`, pending: { type: "select_invoice", invoices, updates: parsed.updates } });
          }
        }
      } else {
        patchMsg(thinkingId, { content: "Non ho capito. Riprova." });
      }
    } catch {
      patchMsg(thinkingId, { content: "❌ Errore di rete." });
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  // ── Confirm handlers ──────────────────────────────────────────────────────
  const handleConfirmTask = async (msgId: string, task: TaskData) => {
    const wantsGcal = task.gcalReminder && task.gcalReminder !== "none";

    // If Google Calendar requested but not connected, prompt sign-in first
    if (wantsGcal && !gcalConnected) {
      patchMsg(msgId, { content: "Connetti Google Calendar per aggiungere l'evento — clicca il pulsante GCAL nell'header, poi riprova." });
      return;
    }

    patchMsg(msgId, { pending: undefined, content: "Salvataggio…" });
    setSavingId(msgId);
    try {
      // ── 1. Save to Notion ────────────────────────────────────────────────
      const res = await fetch("/api/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        patchMsg(msgId, { content: `❌ ${data.error ?? "Errore"}` });
        return;
      }

      // ── 2. Local reminder (browser notification) ─────────────────────────
      if (notificationsOn && task.reminderDate && task.reminderTime) {
        const rid = saveReminder({
          taskTitle: task.titolo,
          cliente: task.cliente,
          reminderAt: `${task.reminderDate}T${task.reminderTime}:00`,
          notionUrl: data.url ?? "",
        });
        await scheduleReminder({
          taskTitle: task.titolo,
          cliente: task.cliente,
          reminderAt: `${task.reminderDate}T${task.reminderTime}:00`,
          notionUrl: data.url ?? "",
          id: rid,
          notified: false,
          createdAt: Date.now(),
        });
      }

      // ── 3. Google Calendar event ──────────────────────────────────────────
      let gcalNote = "";
      if (wantsGcal && gcalConnected) {
        try {
          const gcRes = await fetch("/api/calendar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task, gcalReminder: task.gcalReminder }),
          });
          const gcData = await gcRes.json() as { success?: boolean; error?: string; detail?: string };
          if (gcRes.ok && gcData.success) {
            gcalNote = "\n📅 Evento aggiunto su Google Calendar ✓";
          } else if (gcRes.status === 403 && gcData.error === "SCOPE_ERROR") {
            // Token exists but missing calendar scope — force re-consent with full scopes
            signIn("google");
            gcalNote = "\n⚠️ Accesso al calendario non autorizzato — riconnessione Google in corso…";
          } else {
            gcalNote = `\n⚠️ Calendar: ${gcData.detail ?? gcData.error ?? "Errore"}`;
          }
        } catch {
          gcalNote = "\n⚠️ Calendar: errore di rete";
        }
      }

      // ── 4. Success message ────────────────────────────────────────────────
      const reminderNote =
        task.reminderDate && task.reminderTime
          ? `\n🔔 Reminder ${task.reminderDate} alle ${task.reminderTime}`
          : "";

      patchMsg(msgId, {
        content: `✓ Task "${task.titolo}" salvata su Notion${gcalNote}${reminderNote}`,
        notionUrl: data.url,
      });
    } catch {
      patchMsg(msgId, { content: "❌ Errore di rete." });
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmInvoice = async (msgId: string, invoice: InvoiceData) => {
    patchMsg(msgId, { pending: undefined, content: "Salvataggio…" });
    setSavingId(msgId);
    try {
      const res = await fetch("/api/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoice }) });
      const data = await res.json();
      if (!res.ok || !data.success) { patchMsg(msgId, { content: `❌ ${data.error ?? "Errore"}` }); return; }
      patchMsg(msgId, { content: `✓ Fattura €${invoice.importoLordo} — ${invoice.cliente || "—"} salvata`, notionUrl: data.url });
    } catch { patchMsg(msgId, { content: "❌ Errore di rete." }); }
    finally { setSavingId(null); }
  };

  const handleConfirmTimeLog = async (msgId: string, timelog: TimeLogData) => {
    patchMsg(msgId, { pending: undefined, content: "Salvataggio…" });
    setSavingId(msgId);
    try {
      const res = await fetch("/api/create-timelog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timelog }) });
      const data = await res.json();
      if (!res.ok || !data.success) { patchMsg(msgId, { content: `❌ ${data.error ?? "Errore"}` }); return; }
      const orario = timelog.ora ? ` alle ${timelog.ora}` : "";
      patchMsg(msgId, { content: `✓ ${timelog.oreLavorate}h su ${timelog.cliente || "—"}${orario}`, notionUrl: data.url });
      if (notificationsOn) await sendNotification("⏱ Time Log", `${timelog.oreLavorate}h · ${timelog.cliente || "—"}${orario}`);
    } catch { patchMsg(msgId, { content: "❌ Errore di rete." }); }
    finally { setSavingId(null); }
  };

  const handleSelectTask = (msgId: string, task: TaskSearchResult, updates: TaskUpdate) => {
    patchMsg(msgId, { content: "Task trovata — conferma le modifiche:", pending: { type: "confirm_update", task, updates } });
  };

  const handleSelectInvoice = (msgId: string, invoice: InvoiceSearchResult, updates: InvoiceUpdate) => {
    patchMsg(msgId, { content: "Fattura trovata — conferma le modifiche:", pending: { type: "confirm_update_invoice", invoice, updates } });
  };

  const handleConfirmInvoiceUpdate = async (msgId: string, invoice: InvoiceSearchResult, updates: InvoiceUpdate) => {
    patchMsg(msgId, { pending: undefined, content: "Aggiornamento…" });
    setSavingId(msgId);
    try {
      const res = await fetch("/api/update-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: invoice.id, updates }) });
      const data = await res.json();
      if (!res.ok || !data.success) { patchMsg(msgId, { content: `❌ ${data.error ?? "Errore"}` }); return; }
      const newStato = updates.statoPagamento ?? "";
      patchMsg(msgId, { content: `✓ Fattura "${invoice.descrizione}" → ${newStato}`, notionUrl: data.url });
    } catch { patchMsg(msgId, { content: "❌ Errore di rete." }); }
    finally { setSavingId(null); }
  };

  const handleConfirmUpdate = async (msgId: string, task: TaskSearchResult, updates: TaskUpdate) => {
    patchMsg(msgId, { pending: undefined, content: "Aggiornamento…" });
    setSavingId(msgId);
    try {
      const res = await fetch("/api/update-task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task.id, updates }) });
      const data = await res.json();

      // Page ID from context is stale — fall back to fuzzy search
      if (res.status === 404 && data.error === "NOT_FOUND") {
        patchMsg(msgId, { content: "ID non aggiornato, cerco la task…" });
        const sq = encodeURIComponent(task.titolo || "");
        const cl = encodeURIComponent(task.cliente || "");
        const searchRes = await fetch(`/api/search-tasks?q=${sq}&cliente=${cl}`);
        const searchData = await searchRes.json();
        if (!searchRes.ok || !searchData.tasks) {
          patchMsg(msgId, { content: `❌ ${searchData.error ?? "Errore ricerca"}` });
          return;
        }
        const tasks: TaskSearchResult[] = searchData.tasks;
        if (tasks.length === 0) {
          patchMsg(msgId, { content: `Task non trovata — prova con il titolo esatto in Notion.` });
        } else if (tasks.length === 1) {
          patchMsg(msgId, { content: "Task trovata — conferma le modifiche:", pending: { type: "confirm_update", task: tasks[0], updates } });
        } else {
          patchMsg(msgId, { content: `${tasks.length} task trovate — scegli quale aggiornare:`, pending: { type: "select_task", tasks, updates } });
        }
        return;
      }

      if (!res.ok || !data.success) { patchMsg(msgId, { content: `❌ ${data.error ?? "Errore"}` }); return; }
      patchMsg(msgId, { content: `✓ Task "${task.titolo}" aggiornata`, notionUrl: data.url });
    } catch { patchMsg(msgId, { content: "❌ Errore di rete." }); }
    finally { setSavingId(null); }
  };

  const handleCancel = (msgId: string) =>
    patchMsg(msgId, { pending: undefined, content: "Annullato." });

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); handleSend(); }
  };

  const hasActivePending = messages.some((m) => m.pending && savingId !== m.id);

  // ── EMPTY STATE ───────────────────────────────────────────────────────────
  if (!hasMessages) {
    return (
      <div className="relative flex items-center justify-center min-h-screen bg-[#0a0a0a] overflow-x-hidden px-4 md:px-6 lg:px-10 py-8">
        <div className="w-full max-w-full md:max-w-[600px] lg:max-w-[680px]">

          {/* Logo + sphere */}
          <div className="text-center mb-8 md:mb-10">
            {/* Animated sphere — only in empty state */}
            <div className="flex justify-center mb-5 md:mb-6">
              <div style={{ perspective: "400px" }}>
                <div className="rm-sphere w-12 h-12 md:w-[62px] md:h-[62px] flex items-center justify-center">
                  <span className="font-display text-[#CCFF00] text-[18px] md:text-[25px] leading-none tracking-display" style={{ position: "relative", zIndex: 1 }}>
                    RM
                  </span>
                </div>
              </div>
            </div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-display text-white leading-none">
              REACHMEDIA.IT
            </h1>
            <p className="text-[#444] text-[11px] md:text-xs mt-3 uppercase tracking-[0.18em]">
              OS · Task · Fatture · Time Log
            </p>
          </div>

          {/* Input */}
          <div className="rm-input-box relative bg-[#111111] border border-[#222]">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Scrivi una task, fattura, ore o aggiornamento…"
              className="w-full bg-transparent text-white resize-none leading-relaxed placeholder-[#555] disabled:cursor-not-allowed"
              style={{ padding: "18px 68px 18px 20px", fontSize: "16px", maxHeight: "160px" }}
            />
            <div className="absolute right-3 bottom-3">
              <SendButton loading={loading} onClick={() => handleSend()} disabled={!input.trim() || loading} />
            </div>
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map((text) => (
              <button
                key={text}
                onClick={() => handleSend(text)}
                className="rm-pill text-[#555] text-[13px] border border-[#222] px-3 py-2 hover:text-[#999] hover:border-[#333] transition-colors"
              >
                {text}
              </button>
            ))}
          </div>

        </div>

        {/* Google Calendar — absolute bottom-right */}
        <div className="absolute bottom-6 right-6">
          {gcalConnected ? (
            <button
              onClick={() => signOut({ redirect: false })}
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
              title="Google Calendar connesso — clicca per scollegare"
            >
              <GCalIcon size={20} />
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="6" fill="#22c55e"/>
                <path d="M3 6l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
              title="Connetti Google Calendar"
            >
              <GCalIcon size={20} dim />
              <span className="text-[#444] text-[10px] uppercase tracking-[0.1em] font-semibold">Connetti GCal</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── CHAT STATE ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] overflow-x-hidden overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl md:text-3xl tracking-display text-white hover:opacity-70 transition-opacity duration-200 leading-none">
            REACHMEDIA.IT
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Google Calendar auth button */}
          {gcalConnected ? (
            <button
              onClick={() => signOut({ redirect: false })}
              className="flex items-center gap-1.5 min-h-[44px] px-1 hover:opacity-70 transition-opacity"
              title="Google Calendar connesso — clicca per scollegare"
            >
              <GCalIcon size={20} />
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="6" fill="#22c55e"/>
                <path d="M3 6l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="flex items-center gap-1.5 min-h-[44px] px-1 hover:opacity-60 transition-opacity"
              title="Connetti Google Calendar"
            >
              <GCalIcon size={20} dim />
              <span className="hidden sm:block text-[10px] text-[#444] uppercase tracking-[0.1em]">Connetti</span>
            </button>
          )}

          {/* Notifications toggle */}
          <button
            onClick={toggleNotifications}
            className="flex items-center gap-2.5 shrink-0 min-h-[44px] min-w-[44px] justify-end"
            title={notificationsOn ? "Disattiva notifiche" : "Attiva notifiche"}
          >
            <span className="hidden sm:block text-[10px] text-[#555] uppercase tracking-[0.12em] font-semibold">
              NOTIFICHE
            </span>
            <div className={`relative w-8 h-4 transition-colors ${notificationsOn ? "bg-rm-accent" : "bg-[#222]"}`}>
              <span className={`absolute top-0.5 w-3 h-3 bg-black transition-all ${notificationsOn ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
          </button>
        </div>
      </header>

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-[680px] mx-auto px-6 py-6 flex flex-col gap-5">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onConfirmTask={msg.pending?.type === "create_task" && savingId !== msg.id ? (d) => handleConfirmTask(msg.id, d) : undefined}
              onConfirmInvoice={msg.pending?.type === "create_invoice" && savingId !== msg.id ? (d) => handleConfirmInvoice(msg.id, d) : undefined}
              onConfirmTimeLog={msg.pending?.type === "create_timelog" && savingId !== msg.id ? (d) => handleConfirmTimeLog(msg.id, d) : undefined}
              onSelectTask={msg.pending?.type === "select_task" && savingId !== msg.id ? (task) => handleSelectTask(msg.id, task, (msg.pending as { type: "select_task"; tasks: TaskSearchResult[]; updates: TaskUpdate }).updates) : undefined}
              onConfirmUpdate={msg.pending?.type === "confirm_update" && savingId !== msg.id ? (updates) => handleConfirmUpdate(msg.id, (msg.pending as { type: "confirm_update"; task: TaskSearchResult; updates: TaskUpdate }).task, updates) : undefined}
              onSelectInvoice={msg.pending?.type === "select_invoice" && savingId !== msg.id ? (inv) => handleSelectInvoice(msg.id, inv, (msg.pending as { type: "select_invoice"; invoices: InvoiceSearchResult[]; updates: InvoiceUpdate }).updates) : undefined}
              onConfirmInvoiceUpdate={msg.pending?.type === "confirm_update_invoice" && savingId !== msg.id ? (updates) => handleConfirmInvoiceUpdate(msg.id, (msg.pending as { type: "confirm_update_invoice"; invoice: InvoiceSearchResult; updates: InvoiceUpdate }).invoice, updates) : undefined}
              onCancel={msg.pending && savingId !== msg.id ? () => handleCancel(msg.id) : undefined}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#0a0a0a] border-t border-[#1a1a1a]">
        <div className="w-full max-w-[680px] mx-auto px-6 py-4">
          <div
            className={`rm-input-box flex items-end gap-3 bg-[#111111] border px-4 py-3 transition-colors ${
              hasActivePending
                ? "border-[#1e1e1e] opacity-50"
                : "border-[#222] focus-within:border-[#333]"
            }`}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={loading || hasActivePending}
              placeholder={
                hasActivePending
                  ? "Conferma o annulla prima di continuare…"
                  : "Task, fattura, ore, aggiornamento…"
              }
              className="flex-1 bg-transparent text-white resize-none leading-relaxed max-h-[120px] placeholder-[#444] disabled:cursor-not-allowed"
              style={{ fontSize: "16px", paddingTop: "1px", paddingBottom: "1px" }}
            />
            <SendButton
              loading={loading}
              onClick={() => handleSend()}
              disabled={!input.trim() || loading || hasActivePending}
            />
          </div>
          <p className="hidden md:block text-[#333] text-[10px] uppercase tracking-[0.1em] mt-2 text-center">
            ENTER invia · SHIFT+ENTER a capo
          </p>
        </div>
      </div>
    </div>
  );
}
