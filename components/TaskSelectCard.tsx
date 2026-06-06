"use client";

import type { TaskSearchResult, TaskUpdate } from "@/lib/update-task";

interface Props {
  tasks: TaskSearchResult[];
  updates: TaskUpdate;
  onSelect: (task: TaskSearchResult) => void;
  onCancel: () => void;
}

const updateLabels: Record<string, string> = {
  stato: "Stato", priorita: "Priorità", bloccatoDa: "Bloccato da",
  approvazioneCliente: "Approvazione", tempoReale: "Ore reali",
  deadline: "Deadline", note: "Note",
};

export default function TaskSelectCard({ tasks, updates, onSelect, onCancel }: Props) {
  const summary = Object.entries(updates)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${updateLabels[k] ?? k}: ${v}`)
    .join(" · ");

  return (
    <div className="bg-zinc-800 border border-blue-700/50 rounded-2xl p-4 space-y-3 max-w-sm w-full">
      <p className="text-xs text-blue-400 uppercase tracking-widest font-semibold">🔍 Quale task aggiornare?</p>

      <div className="space-y-2">
        {tasks.map((task) => (
          <button key={task.id} onClick={() => onSelect(task)}
            className="w-full text-left bg-zinc-900 hover:bg-zinc-700/80 border border-zinc-700 hover:border-zinc-500 rounded-xl p-3 transition-all">
            <p className="text-sm text-white font-medium truncate">{task.titolo}</p>
            <div className="flex gap-2 mt-1 flex-wrap items-center">
              {task.cliente && <span className="text-xs text-zinc-400">{task.cliente}</span>}
              {task.stato && <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">{task.stato}</span>}
              {task.priorita && <span className="text-xs text-zinc-500">{task.priorita}</span>}
              {task.deadline && <span className="text-xs text-zinc-600">{task.deadline}</span>}
            </div>
          </button>
        ))}
      </div>

      {summary && (
        <p className="text-xs text-zinc-500 bg-zinc-900/50 rounded-lg px-3 py-2">
          Applicherà: {summary}
        </p>
      )}

      <button onClick={onCancel} className="w-full py-2 rounded-xl text-sm text-zinc-400 border border-zinc-700 hover:border-zinc-500 transition-colors">
        Annulla
      </button>
    </div>
  );
}
