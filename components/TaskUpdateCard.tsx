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

const fi = "w-full bg-transparent text-white text-sm border-b border-[#333] focus:border-[#CCFF00] pb-0.5 placeholder-[#444]";
const fs = "w-full bg-transparent text-white text-sm border-b border-[#333] focus:border-[#CCFF00] pb-0.5 cursor-pointer rm-select-arrow";
const fl = "shrink-0 w-[110px] text-[11px] text-[#555] uppercase tracking-[0.08em] font-semibold leading-[1.4]";
const fr = "flex items-start gap-3 px-4 py-3 border-b border-[#1a1a1a]";

export default function TaskUpdateCard({ task, updates, onConfirm, onCancel }: Props) {
  const [e, setE] = useState<TaskUpdate>({ ...updates });
  const set = <K extends keyof TaskUpdate>(k: K, v: TaskUpdate[K]) => setE((p) => ({ ...p, [k]: v }));
  const changed = Object.values(e).filter((v) => v !== undefined && v !== null && v !== "").length;

  return (
    <div className="bg-[#111111] border border-[#222] w-full max-w-[520px]">

      <div className="px-4 py-3 border-b border-[#1a1a1a]">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white">AGGIORNA TASK</span>
      </div>

      {/* Task preview */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] bg-[#0d0d0d]">
        <p className="text-white text-sm font-bold uppercase truncate">{task.titolo}</p>
        {task.cliente && (
          <p className="text-[#444] text-[10px] uppercase tracking-wide mt-0.5">{task.cliente}</p>
        )}
      </div>

      {/* STATO — badge buttons */}
      {"stato" in e && (
        <div className={fr}>
          <span className={`${fl} pt-0.5`}>STATO</span>
          <div className="flex flex-wrap gap-1.5">
            {STATI_TASK.map((s) => (
              <button
                key={s}
                onClick={() => set("stato", s)}
                className={`px-2.5 py-[3px] text-[11px] font-black uppercase bg-[#1a1a1a] border border-[#333] transition-colors ${e.stato === s ? "text-[#CCFF00]" : "text-[#555]"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PRIORITÀ — badge buttons */}
      {"priorita" in e && (
        <div className={fr}>
          <span className={`${fl} pt-0.5`}>PRIORITÀ</span>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITA.map((p) => (
              <button
                key={p}
                onClick={() => set("priorita", p)}
                className={`px-2.5 py-[3px] text-[11px] font-black uppercase bg-[#1a1a1a] border border-[#333] transition-colors ${e.priorita === p ? "text-[#CCFF00]" : "text-[#555]"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {"bloccatoDa" in e && (
        <div className={fr}>
          <span className={fl}>BLOCCATO</span>
          <select className={fs} value={e.bloccatoDa ?? ""} onChange={(ev) => set("bloccatoDa", ev.target.value)}>
            {BLOCCATO_DA_OPTS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}

      {"approvazioneCliente" in e && (
        <div className={fr}>
          <span className={fl}>APPROV.</span>
          <select className={fs} value={e.approvazioneCliente ?? ""} onChange={(ev) => set("approvazioneCliente", ev.target.value)}>
            {APPROVAZIONE_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}

      {"deadline" in e && (
        <div className={fr}>
          <span className={fl}>DEADLINE</span>
          <input type="date" className={fi} value={e.deadline ?? ""} onChange={(ev) => set("deadline", ev.target.value)} />
        </div>
      )}

      {"tempoReale" in e && (
        <div className={fr}>
          <span className={fl}>ORE REALI</span>
          <input
            type="number" step="0.5" min="0"
            className={fi}
            value={e.tempoReale ?? 0}
            onChange={(ev) => set("tempoReale", parseFloat(ev.target.value) || 0)}
          />
        </div>
      )}

      {"note" in e && (
        <div className={fr}>
          <span className={fl}>NOTE</span>
          <textarea
            rows={2}
            className={`${fi} resize-none`}
            value={e.note ?? ""}
            onChange={(ev) => set("note", ev.target.value)}
          />
        </div>
      )}

      <div className="p-4 flex flex-col gap-2">
        <button
          onClick={() => onConfirm(e)}
          disabled={changed === 0}
          className="w-full py-3 bg-[#CCFF00] text-black text-[11px] font-black uppercase tracking-[0.08em] hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          AGGIORNA
        </button>
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
