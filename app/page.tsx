"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import type { TaskData } from "@/lib/notion";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  taskData?: TaskData;
  awaitingConfirm?: boolean;
  notionUrl?: string;
}

const EXAMPLES = [
  "chiama Squale entro venerdì",
  "prepara newsletter CappellettoShop per lunedì",
  "fix bug Opplant urgente",
  "report analytics NOESI per giovedì",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ciao! 👋 Dimmi cosa devo aggiungere in Notion — es. \"chiama Squale entro venerdì\" o \"newsletter CappellettoShop per lunedì\".",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const addMessage = (msg: Omit<Message, "id">) => {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  };

  const handleSend = useCallback(
    async (text?: string) => {
      const userText = (text ?? input).trim();
      if (!userText || loading) return;

      setInput("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }

      // Add user message
      addMessage({ role: "user", content: userText });
      setLoading(true);

      // Add typing indicator
      const thinkingId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: thinkingId, role: "assistant", content: "⏳ Sto analizzando…" },
      ]);

      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userText }),
        });

        const data = await res.json();

        if (!res.ok || !data.task) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId
                ? {
                    ...m,
                    content:
                      data.error ??
                      "Non sono riuscito a interpretare il messaggio. Riprova.",
                  }
                : m
            )
          );
          return;
        }

        const task: TaskData = data.task;

        // Replace thinking indicator with confirmation card
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? {
                  ...m,
                  content: "Ho estratto questi dettagli — modificali se serve:",
                  taskData: task,
                  awaitingConfirm: true,
                }
              : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? { ...m, content: "Errore di rete. Controlla la connessione e riprova." }
              : m
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [input, loading]
  );

  const handleConfirm = async (msgId: string, task: TaskData) => {
    // Dismiss the confirm card immediately
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, awaitingConfirm: false, content: "✅ Salvataggio…" } : m
      )
    );
    setSavingId(msgId);

    try {
      const res = await fetch("/api/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = [
          data.error ?? "Errore nel salvataggio su Notion.",
          data.details ? `\nDettaglio: ${JSON.stringify(data.details)}` : "",
        ]
          .join("")
          .trim();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, content: `❌ ${errMsg}` } : m
          )
        );
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                content: `✅ Task "${task.titolo}" salvata su Notion!`,
                notionUrl: data.url,
              }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, content: "Errore di rete durante il salvataggio. Riprova." }
            : m
        )
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleCancel = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, awaitingConfirm: false, taskData: undefined, content: "Operazione annullata." }
          : m
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasActiveConfirm = messages.some((m) => m.awaitingConfirm);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">reachmedia OS</p>
          <p className="text-xs text-zinc-500 mt-0.5">Crea task Notion</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          online
        </span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onConfirm={
              msg.awaitingConfirm && savingId !== msg.id
                ? (task) => handleConfirm(msg.id, task)
                : undefined
            }
            onCancel={
              msg.awaitingConfirm && savingId !== msg.id
                ? () => handleCancel(msg.id)
                : undefined
            }
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Example pills — shown only when idle */}
      {messages.length === 1 && !loading && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => handleSend(ex)}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full border border-zinc-700 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
        <div
          className={`flex items-end gap-2 bg-zinc-900 border rounded-2xl px-3 py-2 transition-colors ${
            hasActiveConfirm
              ? "border-zinc-700 opacity-60"
              : "border-zinc-700 focus-within:border-indigo-500"
          }`}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={loading || hasActiveConfirm}
            placeholder={
              hasActiveConfirm
                ? "Conferma o annulla la task sopra…"
                : "Scrivi una task in italiano…"
            }
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 resize-none outline-none leading-5 max-h-[120px] py-0.5 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading || hasActiveConfirm}
            className="shrink-0 mb-0.5 w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            aria-label="Invia"
          >
            {loading ? (
              <svg
                className="w-4 h-4 text-white animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            )}
          </button>
        </div>
        <p className="text-center text-xs text-zinc-600 mt-2">
          Invio con <kbd className="font-mono">Enter</kbd> · a capo con{" "}
          <kbd className="font-mono">Shift+Enter</kbd>
        </p>
      </div>
    </div>
  );
}
