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
    <div className="bg-rm-surface border border-rm-border w-full max-w-[480px]">
      <div className="border-b border-rm-border px-4 py-3">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-rm-muted">QUALE TASK AGGIORNARE?</span>
      </div>

      <div className="divide-y divide-rm-border">
        {tasks.map((task) => (
          <button key={task.id} onClick={() => onSelect(task)}
            className="w-full text-left px-4 py-3 hover:bg-rm-surface2 transition-colors group">
            <p className="text-white text-sm font-semibold group-hover:text-rm-accent transition-colors truncate">{task.titolo}</p>
            <div className="flex gap-3 mt-1">
              {task.cliente && <span className="text-rm-muted text-[10px] uppercase tracking-wide">{task.cliente}</span>}
              {task.stato && <span className="text-[10px] text-rm-faint uppercase">{task.stato}</span>}
              {task.deadline && <span className="text-[10px] text-rm-faint">{task.deadline}</span>}
            </div>
          </button>
        ))}
      </div>

      {summary && (
        <div className="border-t border-rm-border px-4 py-2">
          <p className="text-[10px] text-rm-muted uppercase tracking-wide">Applicherà: {summary}</p>
        </div>
      )}

      <div className="border-t border-rm-border">
        <button onClick={onCancel} className="w-full py-3 text-xs text-rm-muted uppercase tracking-[0.12em] font-semibold hover:text-white transition-colors">ANNULLA</button>
      </div>
    </div>
  );
}
