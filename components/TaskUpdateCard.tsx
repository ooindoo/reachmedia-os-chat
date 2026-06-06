"use client";

import { useState } from "react";
import { STATI_TASK, PRIORITA, BLOCCATO_DA_OPTS, APPROVAZIONE_OPTS } from "@/lib/clients";
import type { TaskSearchResult, TaskUpdate } from "@/lib/update-task";

interface Props {
  task: TaskSearchResult;
  updates: TaskUpdate;
  onConfirm: (updates: TaskUpdate) => void;
  onCancel: () => void;
}

export default function TaskUpdateCard({ task, updates, onConfirm, onCancel }: Props) {
  const [e, setE] = useState<TaskUpdate>({ ...updates });
  const set = <K extends keyof TaskUpdate>(k: K, v: TaskUpdate[K]) => setE((p) => ({ ...p, [k]: v }));

  const changedCount = Object.values(e).filter((v) => v !== undefined && v !== null && v !== "").length;

  return (
    <div className="bg-zinc-800 border border-blue-700/50 rounded-2xl p-4 space-y-3 max-w-sm w-full">
      <p className="text-xs text-blue-400 uppercase tracking-widest font-semibold">✏️ Aggiorna task</p>

      {/* Task header */}
      <div className="bg-zinc-900/60 rounded-xl px-3 py-2.5">
        <p className="text-sm text-white font-medium leading-snug">{task.titolo}</p>
        {task.cliente && <p className="text-xs text-zinc-400 mt-0.5">{task.cliente}</p>}
        <div className="flex gap-2 mt-1">
          {task.stato && <span className="text-xs text-zinc-500">{task.stato}</span>}
          {task.priorita && <span className="text-xs text-zinc-500">{task.priorita}</span>}
        </div>
      </div>

      {/* Stato */}
      {"stato" in e && (
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Stato</label>
          <div className="flex gap-1.5">
            {STATI_TASK.map((s) => (
              <button key={s} onClick={() => set("stato", s)}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${e.stato === s ? "border-blue-500 bg-blue-500/20 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Priorità */}
      {"priorita" in e && (
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Priorità</label>
          <div className="flex gap-1.5">
            {PRIORITA.map((p) => (
              <button key={p} onClick={() => set("priorita", p)}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${e.priorita === p ? "border-blue-500 bg-blue-500/20 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bloccato da */}
      {"bloccatoDa" in e && (
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Bloccato da</label>
          <select className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-blue-500 outline-none"
            value={e.bloccatoDa ?? ""} onChange={(ev) => set("bloccatoDa", ev.target.value)}>
            {BLOCCATO_DA_OPTS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}

      {/* Approvazione cliente */}
      {"approvazioneCliente" in e && (
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Approvazione cliente</label>
          <select className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-blue-500 outline-none"
            value={e.approvazioneCliente ?? ""} onChange={(ev) => set("approvazioneCliente", ev.target.value)}>
            {APPROVAZIONE_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}

      {/* Deadline */}
      {"deadline" in e && (
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Deadline</label>
          <input type="date" className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-blue-500 outline-none"
            value={e.deadline ?? ""} onChange={(ev) => set("deadline", ev.target.value)} />
        </div>
      )}

      {/* Ore reali */}
      {"tempoReale" in e && (
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Ore reali</label>
          <input type="number" step="0.5" min="0"
            className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-blue-500 outline-none"
            value={e.tempoReale ?? 0} onChange={(ev) => set("tempoReale", parseFloat(ev.target.value) || 0)} />
        </div>
      )}

      {/* Note */}
      {"note" in e && (
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Note</label>
          <textarea rows={2} className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-blue-500 outline-none resize-none"
            value={e.note ?? ""} onChange={(ev) => set("note", ev.target.value)} />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-sm text-zinc-400 border border-zinc-700 hover:border-zinc-500 transition-colors">Annulla</button>
        <button onClick={() => onConfirm(e)} disabled={changedCount === 0}
          className="flex-1 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors">
          Aggiorna
        </button>
      </div>
    </div>
  );
}
