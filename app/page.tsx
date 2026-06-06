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

// ── Notification helper ────────────────────────────────────────────────────────
async function sendNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico", badge: "/favicon.ico" });
  }
}

// ── Examples ───────────────────────────────────────────────────────────────────
const EXAMPLES = [
  "chiama Squale entro venerdì",
  "newsletter CappellettoShop per lunedì",
  "fattura Squale 2000€ giugno pagata con bonifico",
  "ho lavorato 3 ore su NOESI su analytics oggi",
  "segna come fatto la call con Squale",
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const uid = () => crypto.randomUUID();

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ciao! 👋 Dimmi cosa devo fare:\n• Task: «chiama Squale venerdì»\n• Fattura: «fattura CappellettoShop 1500€ giugno»\n• Ore: «ho lavorato 2h su NOESI oggi alle 14»\n• Aggiorna: «segna come fatto la newsletter Markershop»",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load notification pref + register SW + bootstrap reminders
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rm-notifications");
      if (saved === "true") setNotificationsOn(true);
    } catch { /* noop */ }

    // Register service worker (enables Notification Triggers API on Chrome/Android)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Reschedule + check overdue reminders from previous sessions
    if (Notification.permission === "granted") {
      bootstrapReminders();
    }

    // ── Polling fallback for Mac/Desktop (tab must be open) ──────────────────
    // Checks every 60s for due reminders — catches any that setTimeout missed
    const poll = setInterval(() => {
      if (Notification.permission === "granted") checkDueReminders();
    }, 60_000);

    // Also check whenever the user focuses the tab (e.g. returns from another app)
    const onVisible = () => {
      if (document.visibilityState === "visible" && Notification.permission === "granted") {
        checkDueReminders();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const toggleNotifications = async () => {
    if (!notificationsOn) {
      // Request permission first
      if (typeof window !== "undefined" && "Notification" in window) {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return; // User denied
      }
      setNotificationsOn(true);
      localStorage.setItem("rm-notifications", "true");
    } else {
      setNotificationsOn(false);
      localStorage.setItem("rm-notifications", "false");
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (ev: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(ev.target.value);
    ev.target.style.height = "auto";
    ev.target.style.height = Math.min(ev.target.scrollHeight, 120) + "px";
  };

  // ── Update a message in place ──────────────────────────────────────────────
  const patchMsg = (id: string, patch: Partial<Message>) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  // ── Send & Parse ───────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text?: string) => {
      const userText = (text ?? input).trim();
      if (!userText || loading) return;

      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto";

      setMessages((prev) => [...prev, { id: uid(), role: "user", content: userText }]);
      setLoading(true);

      const thinkingId = uid();
      setMessages((prev) => [...prev, { id: thinkingId, role: "assistant", content: "⏳ Analizzo…" }]);

      try {
        // 1. Parse intent
        const parseRes = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userText }),
        });
        const parsed = await parseRes.json();

        if (!parseRes.ok) {
          patchMsg(thinkingId, { content: `❌ ${parsed.error ?? "Errore di analisi"}` });
          return;
        }

        // 2. Route by intent
        if (parsed.intent === "create_task") {
          patchMsg(thinkingId, {
            content: "📋 Task estratta — modificala se serve:",
            pending: { type: "create_task", data: parsed.data },
          });
        } else if (parsed.intent === "create_invoice") {
          patchMsg(thinkingId, {
            content: "📄 Fattura estratta — modificala se serve:",
            pending: { type: "create_invoice", data: parsed.data },
          });
        } else if (parsed.intent === "create_timelog") {
          patchMsg(thinkingId, {
            content: "⏱ Sessione estratta — modificala se serve:",
            pending: { type: "create_timelog", data: parsed.data },
          });
        } else if (parsed.intent === "update_task") {
          // Search tasks
          patchMsg(thinkingId, { content: "🔍 Cerco la task…" });
          const sq = encodeURIComponent(parsed.searchQuery || "");
          const cl = encodeURIComponent(parsed.cliente || "");
          const searchRes = await fetch(`/api/search-tasks?q=${sq}&cliente=${cl}`);
          const searchData = await searchRes.json();

          if (!searchRes.ok || !searchData.tasks) {
            patchMsg(thinkingId, { content: `❌ ${searchData.error ?? "Errore ricerca"}` });
            return;
          }

          const tasks: TaskSearchResult[] = searchData.tasks;
          if (tasks.length === 0) {
            const clienteHint = parsed.cliente ? ` per ${parsed.cliente}` : "";
            patchMsg(thinkingId, {
              content: `🔍 Nessuna task trovata${clienteHint}.\n\nSuggerimento: usa una parola chiave del titolo esatto della task in Notion (es. «segna fatto Chiama Squale» se la task si chiama "Chiama Squale SA").`,
            });
          } else if (tasks.length === 1) {
            patchMsg(thinkingId, {
              content: "✏️ Ecco cosa cambierò — conferma:",
              pending: { type: "confirm_update", task: tasks[0], updates: parsed.updates },
            });
          } else {
            patchMsg(thinkingId, {
              content: `Ho trovato ${tasks.length} task simili — quale vuoi aggiornare?`,
              pending: { type: "select_task", tasks, updates: parsed.updates },
            });
          }
        } else {
          patchMsg(thinkingId, { content: "Non ho capito. Prova con un messaggio più specifico." });
        }
      } catch {
        patchMsg(thinkingId, { content: "❌ Errore di rete. Controlla la connessione." });
      } finally {
        setLoading(false);
      }
    },
    [input, loading]
  );

  // ── Confirm Task ───────────────────────────────────────────────────────────
  const handleConfirmTask = async (msgId: string, task: TaskData) => {
    patchMsg(msgId, { pending: undefined, content: "✅ Salvataggio task…" });
    setSavingId(msgId);
    try {
      const res = await fetch("/api/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        patchMsg(msgId, { content: `❌ ${data.error ?? "Errore salvataggio task"}` });
      } else {
        // Schedule reminder if set
        if (notificationsOn && task.reminderDate && task.reminderTime) {
          const reminderAt = `${task.reminderDate}T${task.reminderTime}:00`;
          const reminderData = {
            taskTitle: task.titolo,
            cliente: task.cliente,
            reminderAt,
            notionUrl: data.url ?? "",
          };
          const rid = saveReminder(reminderData);
          // Schedule with new API (no callback needed — fireReminder handles it)
          await scheduleReminder({
            ...reminderData,
            id: rid,
            notified: false,
            createdAt: Date.now(),
          });
          const orario = `${task.reminderDate} alle ${task.reminderTime}`;
          patchMsg(msgId, {
            content: `✅ Task «${task.titolo}» salvata!\n🔔 Reminder impostato per ${orario}`,
            notionUrl: data.url,
          });
        } else {
          patchMsg(msgId, { content: `✅ Task «${task.titolo}» salvata!`, notionUrl: data.url });
        }
      }
    } catch {
      patchMsg(msgId, { content: "❌ Errore di rete durante il salvataggio." });
    } finally {
      setSavingId(null);
    }
  };

  // ── Confirm Invoice ────────────────────────────────────────────────────────
  const handleConfirmInvoice = async (msgId: string, invoice: InvoiceData) => {
    patchMsg(msgId, { pending: undefined, content: "✅ Salvataggio fattura…" });
    setSavingId(msgId);
    try {
      const res = await fetch("/api/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        patchMsg(msgId, { content: `❌ ${data.error ?? "Errore salvataggio fattura"}` });
      } else {
        patchMsg(msgId, { content: `✅ Fattura «${invoice.descrizione}» (€${invoice.importoLordo}) salvata!`, notionUrl: data.url });
      }
    } catch {
      patchMsg(msgId, { content: "❌ Errore di rete durante il salvataggio." });
    } finally {
      setSavingId(null);
    }
  };

  // ── Confirm Time Log ───────────────────────────────────────────────────────
  const handleConfirmTimeLog = async (msgId: string, timelog: TimeLogData) => {
    patchMsg(msgId, { pending: undefined, content: "✅ Salvataggio time log…" });
    setSavingId(msgId);
    try {
      const res = await fetch("/api/create-timelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timelog }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        patchMsg(msgId, { content: `❌ ${data.error ?? "Errore salvataggio time log"}` });
      } else {
        const orario = timelog.ora ? ` alle ${timelog.ora}` : "";
        patchMsg(msgId, {
          content: `✅ ${timelog.oreLavorate}h su ${timelog.cliente || "—"}${orario} registrate!`,
          notionUrl: data.url,
        });
        if (notificationsOn) {
          await sendNotification(
            "⏱ Time Log salvato",
            `${timelog.oreLavorate}h · ${timelog.cliente || "—"}${orario} · ${timelog.tipoSessione}`
          );
        }
      }
    } catch {
      patchMsg(msgId, { content: "❌ Errore di rete durante il salvataggio." });
    } finally {
      setSavingId(null);
    }
  };

  // ── Select Task (from multiple results) ────────────────────────────────────
  const handleSelectTask = (msgId: string, task: TaskSearchResult, updates: TaskUpdate) => {
    patchMsg(msgId, {
      content: "✏️ Ecco cosa cambierò — conferma:",
      pending: { type: "confirm_update", task, updates },
    });
  };

  // ── Confirm Update ─────────────────────────────────────────────────────────
  const handleConfirmUpdate = async (msgId: string, task: TaskSearchResult, updates: TaskUpdate) => {
    patchMsg(msgId, { pending: undefined, content: "✅ Aggiornamento in corso…" });
    setSavingId(msgId);
    try {
      const res = await fetch("/api/update-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, updates }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        patchMsg(msgId, { content: `❌ ${data.error ?? "Errore aggiornamento"}` });
      } else {
        patchMsg(msgId, { content: `✅ Task «${task.titolo}» aggiornata!`, notionUrl: data.url });
      }
    } catch {
      patchMsg(msgId, { content: "❌ Errore di rete durante l'aggiornamento." });
    } finally {
      setSavingId(null);
    }
  };

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const handleCancel = (msgId: string) => {
    patchMsg(msgId, { pending: undefined, content: "Operazione annullata." });
  };

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); handleSend(); }
  };

  const hasActivePending = messages.some((m) => m.pending && savingId !== m.id);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">reachmedia OS</p>
          <p className="text-xs text-zinc-500 mt-0.5">Task · Fatture · Time Log</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Notifications toggle */}
          <button
            onClick={toggleNotifications}
            title={notificationsOn ? "Notifiche attive — clicca per disattivare" : "Attiva notifiche Time Log"}
            className={`relative w-9 h-5 rounded-full transition-colors ${notificationsOn ? "bg-indigo-600" : "bg-zinc-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${notificationsOn ? "translate-x-4" : "translate-x-0"}`} />
          </button>
          <span className="text-lg leading-none" title={notificationsOn ? "Notifiche attive" : "Notifiche disattivate"}>
            {notificationsOn ? "🔔" : "🔕"}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            online
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onConfirmTask={
              msg.pending?.type === "create_task" && savingId !== msg.id
                ? (d) => handleConfirmTask(msg.id, d) : undefined
            }
            onConfirmInvoice={
              msg.pending?.type === "create_invoice" && savingId !== msg.id
                ? (d) => handleConfirmInvoice(msg.id, d) : undefined
            }
            onConfirmTimeLog={
              msg.pending?.type === "create_timelog" && savingId !== msg.id
                ? (d) => handleConfirmTimeLog(msg.id, d) : undefined
            }
            onSelectTask={
              msg.pending?.type === "select_task" && savingId !== msg.id
                ? (task) => handleSelectTask(msg.id, task, (msg.pending as { type: "select_task"; tasks: TaskSearchResult[]; updates: TaskUpdate }).updates)
                : undefined
            }
            onConfirmUpdate={
              msg.pending?.type === "confirm_update" && savingId !== msg.id
                ? (updates) => handleConfirmUpdate(msg.id, (msg.pending as { type: "confirm_update"; task: TaskSearchResult; updates: TaskUpdate }).task, updates)
                : undefined
            }
            onCancel={msg.pending && savingId !== msg.id ? () => handleCancel(msg.id) : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Example pills */}
      {messages.length === 1 && !loading && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => handleSend(ex)}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full border border-zinc-700 transition-colors">
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
        <div className={`flex items-end gap-2 bg-zinc-900 border rounded-2xl px-3 py-2 transition-colors ${
          hasActivePending ? "border-zinc-700 opacity-60" : "border-zinc-700 focus-within:border-indigo-500"
        }`}>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={loading || hasActivePending}
            placeholder={hasActivePending ? "Conferma o annulla prima di continuare…" : "Task, fattura, ore, aggiorna…"}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 resize-none outline-none leading-5 max-h-[120px] py-0.5 disabled:cursor-not-allowed"
          />
          <button onClick={() => handleSend()} disabled={!input.trim() || loading || hasActivePending}
            className="shrink-0 mb-0.5 w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            aria-label="Invia">
            {loading ? (
              <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-center text-xs text-zinc-600 mt-2">
          <kbd className="font-mono">Enter</kbd> invia · <kbd className="font-mono">Shift+Enter</kbd> a capo
        </p>
      </div>
    </div>
  );
}
