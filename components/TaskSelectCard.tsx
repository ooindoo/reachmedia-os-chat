"use client";

import type { TaskSearchResult, TaskUpdate } from "@/lib/update-task";

interface Props {
  tasks: TaskSearchResult[];
  updates: TaskUpdate;
  onSelect: (task: TaskSearchResult) => void;
  onCancel: () => void;
}

export default function TaskSelectCard({ tasks, updates, onSelect, onCancel }: Props) {
  const summary = Object.entries(updates)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");

  return (
    <div className="bg-[#111111] border border-[#222] w-full max-w-[520px]">

      <div className="px-4 py-3 border-b border-[#1a1a1a]">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white">QUALE TASK?</span>
      </div>

      <div className="divide-y divide-[#1a1a1a]">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onSelect(task)}
            className="w-full text-left px-4 py-3 hover:bg-[#1a1a1a] transition-colors group"
          >
            <p className="text-white text-sm font-semibold group-hover:text-rm-accent transition-colors truncate">
              {task.titolo}
            </p>
            <div className="flex gap-3 mt-1 flex-wrap">
              {task.cliente && (
                <span className="text-[10px] text-[#555] uppercase tracking-wide">{task.cliente}</span>
              )}
              {task.stato && (
                <span className="text-[10px] text-[#444] uppercase">{task.stato}</span>
              )}
              {task.deadline && (
                <span className="text-[10px] text-[#444]">{task.deadline}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {summary && (
        <div className="border-t border-[#1a1a1a] px-4 py-2">
          <p className="text-[10px] text-[#444] uppercase tracking-wide">Applicherà: {summary}</p>
        </div>
      )}

      <div className="p-4 border-t border-[#1a1a1a]">
        <button
          onClick={onCancel}
          className="w-full py-[11px] bg-transparent border border-[#333] text-[#666] text-[11px] uppercase tracking-[0.08em] font-semibold hover:text-white hover:border-[#555] transition-colors"
        >
          ANNULLA
        </button>
      </div>
    </div>
  );
}
