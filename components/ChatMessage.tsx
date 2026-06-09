"use client";

import type { Message } from "@/app/page";

// ── Notion deep-link with HTTPS fallback ──────────────────────────────────────
// Converts https://www.notion.so/… → notion://www.notion.so/…
// If Notion app is installed the OS intercepts the custom scheme and opens the
// app (window loses focus → we cancel the fallback timer).
// If not installed nothing happens for 500ms → we open the https:// URL instead.
function toDeepLink(httpsUrl: string): string {
  return httpsUrl.replace(/^https:\/\//, "notion://");
}

function openNotion(httpsUrl: string) {
  const deepLink = toDeepLink(httpsUrl);

  // Cancel fallback when app intercepts the link (page loses focus)
  let cancelled = false;
  const onBlur = () => { cancelled = true; };
  window.addEventListener("blur", onBlur, { once: true });

  window.location.href = deepLink;

  setTimeout(() => {
    window.removeEventListener("blur", onBlur);
    if (!cancelled) {
      // App didn't open — open in browser as fallback
      window.open(httpsUrl, "_blank", "noopener,noreferrer");
    }
  }, 500);
}

function NotionLink({ url }: { url: string }) {
  return (
    <button
      onClick={() => openNotion(url)}
      className="inline-flex items-center gap-1.5 text-rm-accent text-[11px] font-semibold uppercase tracking-[0.1em] hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 p-0"
    >
      <span>→</span>
      <span>APRI SU NOTION</span>
    </button>
  );
}
import TaskConfirmCard from "./TaskConfirmCard";
import InvoiceConfirmCard from "./InvoiceConfirmCard";
import TimeLogConfirmCard from "./TimeLogConfirmCard";
import TaskSelectCard from "./TaskSelectCard";
import TaskUpdateCard from "./TaskUpdateCard";
import InvoiceUpdateCard from "./InvoiceUpdateCard";
import InvoiceSelectCard from "./InvoiceSelectCard";
import type { TaskData } from "@/lib/notion";
import type { InvoiceData } from "@/lib/invoice";
import type { TimeLogData } from "@/lib/timelog";
import type { TaskSearchResult, TaskUpdate } from "@/lib/update-task";
import type { InvoiceSearchResult, InvoiceUpdate } from "@/lib/invoice-update";

interface Props {
  message: Message;
  onConfirmTask?: (data: TaskData) => void;
  onConfirmInvoice?: (data: InvoiceData) => void;
  onConfirmTimeLog?: (data: TimeLogData) => void;
  onSelectTask?: (task: TaskSearchResult) => void;
  onConfirmUpdate?: (updates: TaskUpdate) => void;
  onSelectInvoice?: (invoice: InvoiceSearchResult) => void;
  onConfirmInvoiceUpdate?: (updates: InvoiceUpdate) => void;
  onCancel?: () => void;
}

export default function ChatMessage({
  message, onConfirmTask, onConfirmInvoice, onConfirmTimeLog,
  onSelectTask, onConfirmUpdate,
  onSelectInvoice, onConfirmInvoiceUpdate,
  onCancel,
}: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="rm-bubble-user bg-rm-accent text-black font-semibold text-sm py-3 px-[18px] max-w-[75%] break-words whitespace-pre-wrap leading-[1.55]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="flex flex-col gap-3 max-w-full w-full">
        {message.content && (
          <div className="rm-bubble-ai bg-[#111111] text-white text-sm py-3 px-[18px] max-w-[85%] break-words whitespace-pre-wrap leading-[1.55]">
            {message.content}
          </div>
        )}

        {message.pending?.type === "create_task" && onConfirmTask && onCancel && (
          <TaskConfirmCard task={message.pending.data} onConfirm={onConfirmTask} onCancel={onCancel} />
        )}
        {message.pending?.type === "create_invoice" && onConfirmInvoice && onCancel && (
          <InvoiceConfirmCard invoice={message.pending.data} onConfirm={onConfirmInvoice} onCancel={onCancel} />
        )}
        {message.pending?.type === "create_timelog" && onConfirmTimeLog && onCancel && (
          <TimeLogConfirmCard timelog={message.pending.data} onConfirm={onConfirmTimeLog} onCancel={onCancel} />
        )}
        {message.pending?.type === "select_task" && onSelectTask && onCancel && (
          <TaskSelectCard tasks={message.pending.tasks} updates={message.pending.updates} onSelect={onSelectTask} onCancel={onCancel} />
        )}
        {message.pending?.type === "confirm_update" && onConfirmUpdate && onCancel && (
          <TaskUpdateCard task={message.pending.task} updates={message.pending.updates} onConfirm={onConfirmUpdate} onCancel={onCancel} />
        )}
        {message.pending?.type === "select_invoice" && onSelectInvoice && onCancel && (
          <InvoiceSelectCard invoices={message.pending.invoices} updates={message.pending.updates} onSelect={onSelectInvoice} onCancel={onCancel} />
        )}
        {message.pending?.type === "confirm_update_invoice" && onConfirmInvoiceUpdate && onCancel && (
          <InvoiceUpdateCard invoice={message.pending.invoice} updates={message.pending.updates} onConfirm={onConfirmInvoiceUpdate} onCancel={onCancel} />
        )}

        {message.notionUrl && <NotionLink url={message.notionUrl} />}
      </div>
    </div>
  );
}
