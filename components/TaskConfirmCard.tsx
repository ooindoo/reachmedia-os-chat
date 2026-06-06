"use client";

import { useState } from "react";
import { CLIENT_NAMES, TIPI_ATTIVITA, PRIORITA } from "@/lib/clients";
import type { TaskData } from "@/lib/notion";

interface Props {
  task: TaskData;
  onConfirm: (task: TaskData) => void;
  onCancel: () => void;
}

export default function TaskConfirmCard({ task, onConfirm, onCancel }: Props) {
  const [edited, setEdited] = useState<TaskData>({ ...task });

  const set = <K extends keyof TaskData>(key: K, value: TaskData[K]) =>
    setEdited((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-4 space-y-3 max-w-sm w-full">
      <p className="text-xs text-zinc-400 uppercase tracking-widest font-semibold">
        Conferma task
      </p>

      {/* Titolo */}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Titolo</label>
        <input
          className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-indigo-500 outline-none"
          value={edited.titolo}
          onChange={(e) => set("titolo", e.target.value)}
        />
      </div>

      {/* Cliente */}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Cliente</label>
        <select
          className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-indigo-500 outline-none"
          value={edited.cliente}
          onChange={(e) => set("cliente", e.target.value)}
        >
          <option value="">— Nessun cliente —</option>
          {CLIENT_NAMES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Deadline */}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Deadline</label>
        <input
          type="date"
          className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-indigo-500 outline-none"
          value={edited.deadline}
          onChange={(e) => set("deadline", e.target.value)}
        />
      </div>

      {/* Tipo attività */}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Tipo attività</label>
        <select
          className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-indigo-500 outline-none"
          value={edited.tipoAttivita}
          onChange={(e) => set("tipoAttivita", e.target.value as TaskData["tipoAttivita"])}
        >
          {TIPI_ATTIVITA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Priorità */}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Priorità</label>
        <div className="flex gap-2">
          {PRIORITA.map((p) => (
            <button
              key={p}
              onClick={() => set("priorita", p)}
              className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                edited.priorita === p
                  ? "border-indigo-500 bg-indigo-500/20 text-white"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-xl text-sm text-zinc-400 border border-zinc-700 hover:border-zinc-500 transition-colors"
        >
          Annulla
        </button>
        <button
          onClick={() => onConfirm(edited)}
          className="flex-1 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          Salva su Notion
        </button>
      </div>
    </div>
  );
}
