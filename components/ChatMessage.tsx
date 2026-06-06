"use client";

import type { Message } from "@/app/page";
import TaskConfirmCard from "./TaskConfirmCard";
import type { TaskData } from "@/lib/notion";

interface Props {
  message: Message;
  onConfirm?: (task: TaskData) => void;
  onCancel?: () => void;
}

export default function ChatMessage({ message, onConfirm, onCancel }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {isUser ? (
        <div className="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-br-sm max-w-xs break-words">
          {message.content}
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-w-xs">
          {message.content && (
            <div className="bg-zinc-800 text-zinc-100 text-sm px-4 py-2.5 rounded-2xl rounded-bl-sm break-words">
              {message.content}
            </div>
          )}
          {message.taskData && message.awaitingConfirm && onConfirm && onCancel && (
            <TaskConfirmCard
              task={message.taskData}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          )}
          {message.notionUrl && (
            <a
              href={message.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              <span>↗</span> Apri su Notion
            </a>
          )}
        </div>
      )}
    </div>
  );
}
