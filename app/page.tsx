"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import type { TaskData } from "@/lib/notion";
import type { InvoiceData } from "@/lib/invoice";
import type { TimeLogData } from "@/lib/timelog";
import type { TaskSearchResult, TaskUpdate } from "@/lib/update-task";
import { saveReminder, scheduleReminder, bootstrapReminders, checkDueReminders } from "@/lib/reminders";

// ── Types ──────────────────────────────────────────────────────────────────────
export type PendingAction =
  | { type: "create_task"; data: TaskData }
  | { type: "create_invoice"; data: InvoiceData }
  | { type: "create_timelog"; data: TimeLogData }
  | { type: "select_task"; tasks: TaskSearchResult[]; updates: TaskUpdate }
  | { type: "confirm_update"; task: TaskSearchResult; updates: TaskUpdate };

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: PendingAction;
  notionUrl?: string;
}

// ── Examples ───────────────────────────────────────────────────────────────────
const EXAMPLES = [
  { label: "TASK", text: "chiama Squale venerdì" },
  { label: "FATTURA", text: "fattura CappellettoShop 1500€ giugno" },
  { label: "ORE", text: "3h su NOESI analytics oggi" },
  { label: "UPDATE", text: "segna fatto newsletter Markershop" },
];

// ── Notification helper ────────────────────────────────────────────────────────
async function sendNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.svg" });
  }
}

const uid = () => crypto.randomUUID();

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ciao. Dimmi cosa devo fare:\n• «chiama Squale venerdì»\n• «fattura CappellettoShop 1500€»\n• «3h su NOESI analytics oggi»\n• «segna fatto newsletter Markershop»",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem("rm-notifications") === "true") setNotificationsOn(true);
    } catch { /* noop */ }

    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (Notification.permission === "granted") bootstrapReminders();

    const poll = setInterval(() => {
      if (Notification.permission === "granted") checkDueReminders();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Notification.permission === "granted") checkDueReminders();
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
    ev.target.style.height = Math.min(ev.target.scrollHeight, 120) + "px";
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
    patchMsg(msgId, { pending: undefined, content: "Salvataggio…" });
    setSavingId(msgId);
    try {
      const res = await fetch("/api/create-task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
      const data = await res.json();
      if (!res.ok || !data.success) { patchMsg(msgId, { content: `❌ ${data.error ?? "Errore"}` }); return; }
      if (notificationsOn && task.reminderDate && task.reminderTime) {
        const rid = saveReminder({ taskTitle: task.titolo, cliente: task.cliente, reminderAt: `${task.reminderDate}T${task.reminderTime}:00`, notionUrl: data.url ?? "" });
        await scheduleReminder({ taskTitle: task.titolo, cliente: task.cliente, reminderAt: `${task.reminderDate}T${task.reminderTime}:00`, notionUrl: data.url ?? "", id: rid, notified: false, createdAt: Date.now() });
      }
      patchMsg(msgId, { content: `✓ Task "${task.titolo}" salvata${task.reminderDate && task.reminderTime ? `\n🔔 Reminder ${task.reminderDate} alle ${task.reminderTime}` : ""}`, notionUrl: data.url });
    } catch { patchMsg(msgId, { content: "❌ Errore di rete." }); }
    finally { setSavingId(null); }
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

  const handleConfirmUpdate = async (msgId: string, task: TaskSearchResult, updates: TaskUpdate) => {
    patchMsg(msgId, { pending: undefined, content: "Aggiornamento…" });
    setSavingId(msgId);
    try {
      const res = await fetch("/api/update-task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task.id, updates }) });
      const data = await res.json();
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

  return (
    <div className="flex h-screen bg-rm-bg overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[200px] lg:w-[220px] border-r border-rm-border shrink-0 p-5 overflow-y-auto">
        {/* Logo */}
        <div className="mb-6">
          <svg viewBox="0 0 160 18" width="160" height="18" aria-label="REACHMEDIA.IT">
            <text x="0" y="16" font-family="system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="16" fill="#FFFFFF" text-anchor="start" letter-spacing="-0.5">REACHMEDIA.IT</text>
          </svg>
          <p className="text-rm-muted text-[10px] uppercase tracking-[0.15em] mt-1">
            OS CHAT
          </p>
        </div>

        <div className="border-t border-rm-border mb-5" />

        {/* Examples */}
        <div className="space-y-1 flex-1">
          <p className="text-[#444] text-[9px] font-black uppercase tracking-[0.15em] mb-3">ESEMPI</p>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.text}
              onClick={() => handleSend(ex.text)}
              className="block w-full text-left group py-1.5"
            >
              <span className="rm-chip mr-2">{ex.label}</span>
              <span className="text-rm-muted text-xs group-hover:text-white transition-colors">
                {ex.text}
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-rm-border my-5" />

        {/* Notifications + status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rm-muted uppercase tracking-[0.12em] font-semibold">
              NOTIFICHE
            </span>
            <button
              onClick={toggleNotifications}
              className="flex items-center gap-2"
              title={notificationsOn ? "Disattiva" : "Attiva"}
            >
              <div className={`relative w-8 h-4 transition-colors ${notificationsOn ? "bg-rm-accent" : "bg-rm-faint"}`}>
                <span className={`absolute top-0.5 w-3 h-3 bg-black transition-transform ${notificationsOn ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className={`text-base leading-none ${notificationsOn ? "text-rm-accent" : "text-rm-faint"}`}>
                {notificationsOn ? "🔔" : "🔕"}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-rm-accent animate-pulse block" />
            <span className="text-[10px] text-rm-muted uppercase tracking-[0.12em]">ONLINE</span>
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-rm-border shrink-0">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 130 14" width="130" height="14" aria-label="REACHMEDIA.IT">
              <text x="0" y="12" font-family="system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="13" fill="#FFFFFF" text-anchor="start" letter-spacing="-0.3">REACHMEDIA.IT</text>
            </svg>
            <span className="text-rm-muted text-[10px] uppercase tracking-widest hidden xs:inline">OS</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleNotifications}>
              <span className={`text-base ${notificationsOn ? "text-rm-accent" : "text-rm-faint"}`}>
                {notificationsOn ? "🔔" : "🔕"}
              </span>
            </button>
            <span className="w-1.5 h-1.5 bg-rm-accent animate-pulse block" />
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[700px] mx-auto px-4 md:px-6 py-6 space-y-1">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onConfirmTask={msg.pending?.type === "create_task" && savingId !== msg.id ? (d) => handleConfirmTask(msg.id, d) : undefined}
                onConfirmInvoice={msg.pending?.type === "create_invoice" && savingId !== msg.id ? (d) => handleConfirmInvoice(msg.id, d) : undefined}
                onConfirmTimeLog={msg.pending?.type === "create_timelog" && savingId !== msg.id ? (d) => handleConfirmTimeLog(msg.id, d) : undefined}
                onSelectTask={msg.pending?.type === "select_task" && savingId !== msg.id ? (task) => handleSelectTask(msg.id, task, (msg.pending as { type: "select_task"; tasks: TaskSearchResult[]; updates: TaskUpdate }).updates) : undefined}
                onConfirmUpdate={msg.pending?.type === "confirm_update" && savingId !== msg.id ? (updates) => handleConfirmUpdate(msg.id, (msg.pending as { type: "confirm_update"; task: TaskSearchResult; updates: TaskUpdate }).task, updates) : undefined}
                onCancel={msg.pending && savingId !== msg.id ? () => handleCancel(msg.id) : undefined}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-rm-border shrink-0 px-4 md:px-6 py-4">
          <div className="max-w-[700px] mx-auto">
            <div className={`flex items-end gap-3 border-b pb-2 transition-colors ${hasActivePending ? "border-rm-faint opacity-50" : "border-rm-faint focus-within:border-rm-accent"}`}>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={loading || hasActivePending}
                placeholder={hasActivePending ? "Conferma o annulla prima di continuare…" : "Scrivi una task, fattura, ore o aggiornamento…"}
                className="flex-1 bg-transparent text-white text-sm resize-none outline-none leading-5 max-h-[120px] py-0.5 placeholder-rm-faint disabled:cursor-not-allowed"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading || hasActivePending}
                aria-label="Invia"
                className="shrink-0 mb-0.5 bg-rm-accent text-black font-black text-xs uppercase px-3 py-1.5 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? "…" : "INVIA"}
              </button>
            </div>
            <p className="text-rm-faint text-[10px] uppercase tracking-[0.12em] mt-2">
              ENTER invia · SHIFT+ENTER a capo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
