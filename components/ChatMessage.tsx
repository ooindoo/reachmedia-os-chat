"use client";

import type { Message } from "@/app/page";
import TaskConfirmCard from "./TaskConfirmCard";
import InvoiceConfirmCard from "./InvoiceConfirmCard";
import TimeLogConfirmCard from "./TimeLogConfirmCard";
import TaskSelectCard from "./TaskSelectCard";
import TaskUpdateCard from "./TaskUpdateCard";
import type { TaskData } from "@/lib/notion";
import type { InvoiceData } from "@/lib/invoice";
import type { TimeLogData } from "@/lib/timelog";
import type { TaskSearchResult, TaskUpdate } from "@/lib/update-task";

interface Props {
  message: Message;
  onConfirmTask?: (data: TaskData) => void;
  onConfirmInvoice?: (data: InvoiceData) => void;
  onConfirmTimeLog?: (data: TimeLogData) => void;
  onSelectTask?: (task: TaskSearchResult) => void;
  onConfirmUpdate?: (updates: TaskUpdate) => void;
  onCancel?: () => void;
}

export default function ChatMessage({
  message, onConfirmTask, onConfirmInvoice, onConfirmTimeLog,
  onSelectTask, onConfirmUpdate, onCancel,
}: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-rm-accent text-black font-bold text-sm py-3 px-3.5 md:py-[14px] md:px-[18px] max-w-[80%] md:max-w-[75%] break-words whitespace-pre-wrap leading-[1.5]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="flex flex-col gap-2 max-w-full w-full">
        {message.content && (
          <div className="bg-[#111111] text-white text-sm py-3 px-3.5 md:py-[14px] md:px-[18px] max-w-[88%] md:max-w-[85%] break-words whitespace-pre-wrap leading-[1.5]">
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

        {message.notionUrl && (
          <a
            href={message.notionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-rm-accent text-[11px] font-semibold uppercase tracking-[0.1em] no-underline hover:opacity-70 transition-opacity"
          >
            <span>→</span>
            <span>APRI SU NOTION</span>
          </a>
        )}
      </div>
    </div>
  );
}
