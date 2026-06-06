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
  const changed = Object.values(e).filter((v) => v !== undefined && v !== null && v !== "").length;

  return (
    <div className="bg-rm-surface border border-rm-border w-full max-w-[480px]">
      <div className="border-b border-rm-border px-4 py-3">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-rm-muted">AGGIORNA TASK</span>
      </div>

      {/* Task preview */}
      <div className="px-4 py-3 border-b border-rm-border bg-rm-surface2">
        <p className="text-white text-sm font-bold uppercase truncate">{task.titolo}</p>
        {task.cliente && <p className="text-rm-muted text-[10px] uppercase tracking-wide mt-0.5">{task.cliente}</p>}
      </div>

      <div className="px-4 py-4 space-y-4">
        {"stato" in e && (
          <div>
            <label className="rm-label">STATO</label>
            <div className="flex gap-2 mt-1">
              {STATI_TASK.map((s) => (
                <button key={s} onClick={() => set("stato", s)}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase transition-colors ${e.stato === s ? "bg-rm-accent text-black" : "border border-rm-border text-rm-muted hover:text-white"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {"priorita" in e && (
          <div>
            <label className="rm-label">PRIORITÀ</label>
            <div className="flex gap-2 mt-1">
              {PRIORITA.map((p) => (
                <button key={p} onClick={() => set("priorita", p)}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase transition-colors ${e.priorita === p ? "bg-rm-accent text-black" : "border border-rm-border text-rm-muted hover:text-white"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {"bloccatoDa" in e && (
          <div>
            <label className="rm-label">BLOCCATO DA</label>
            <select className="rm-select" value={e.bloccatoDa ?? ""} onChange={(ev) => set("bloccatoDa", ev.target.value)}>
              {BLOCCATO_DA_OPTS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        {"approvazioneCliente" in e && (
          <div>
            <label className="rm-label">APPROVAZIONE CLIENTE</label>
            <select className="rm-select" value={e.approvazioneCliente ?? ""} onChange={(ev) => set("approvazioneCliente", ev.target.value)}>
              {APPROVAZIONE_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}

        {"deadline" in e && (
          <div>
            <label className="rm-label">DEADLINE</label>
            <input type="date" className="rm-input" value={e.deadline ?? ""} onChange={(ev) => set("deadline", ev.target.value)} />
          </div>
        )}

        {"tempoReale" in e && (
          <div>
            <label className="rm-label">ORE REALI</label>
            <input type="number" step="0.5" min="0" className="rm-input"
              value={e.tempoReale ?? 0} onChange={(ev) => set("tempoReale", parseFloat(ev.target.value) || 0)} />
          </div>
        )}

        {"note" in e && (
          <div>
            <label className="rm-label">NOTE</label>
            <textarea rows={2} className="rm-input resize-none"
              value={e.note ?? ""} onChange={(ev) => set("note", ev.target.value)} />
          </div>
        )}
      </div>

      <div className="border-t border-rm-border flex">
        <button onClick={onCancel} className="flex-1 py-3 text-xs text-rm-muted uppercase tracking-[0.12em] font-semibold border-r border-rm-border hover:text-white transition-colors">ANNULLA</button>
        <button onClick={() => onConfirm(e)} disabled={changed === 0}
          className="flex-[2] py-3 bg-rm-accent text-black text-xs font-black uppercase tracking-[0.1em] hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          AGGIORNA
        </button>
      </div>
    </div>
  );
}
