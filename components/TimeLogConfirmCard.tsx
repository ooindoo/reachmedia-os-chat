"use client";

import { useState } from "react";
import { CLIENT_NAMES, TIPI_SESSIONE, ENERGIE, FATTURABILE_OPTS } from "@/lib/clients";
import type { TimeLogData } from "@/lib/timelog";

interface Props {
  timelog: TimeLogData;
  onConfirm: (timelog: TimeLogData) => void;
  onCancel: () => void;
}

export default function TimeLogConfirmCard({ timelog, onConfirm, onCancel }: Props) {
  const [e, setE] = useState<TimeLogData>({ ...timelog });
  const set = <K extends keyof TimeLogData>(k: K, v: TimeLogData[K]) => setE((p) => ({ ...p, [k]: v }));

  return (
    <div className="bg-rm-surface border border-rm-border w-full max-w-[480px]">
      <div className="border-b border-rm-border px-4 py-3">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-rm-muted">⏱ TIME LOG</span>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div>
          <label className="rm-label">DESCRIZIONE SESSIONE</label>
          <input className="rm-input" value={e.descrizione} onChange={(ev) => set("descrizione", ev.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="rm-label">CLIENTE</label>
            <select className="rm-select" value={e.cliente} onChange={(ev) => set("cliente", ev.target.value)}>
              <option value="">— nessuno —</option>
              {CLIENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="rm-label">ORE LAVORATE</label>
            <input type="number" step="0.5" min="0" className="rm-input"
              value={e.oreLavorate} onChange={(ev) => set("oreLavorate", parseFloat(ev.target.value) || 0)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="rm-label">DATA</label>
            <input type="date" className="rm-input" value={e.data} onChange={(ev) => set("data", ev.target.value)} />
          </div>
          <div>
            <label className="rm-label">ORA INIZIO</label>
            <input type="time" className="rm-input" value={e.ora} onChange={(ev) => set("ora", ev.target.value)} placeholder="—" />
          </div>
        </div>

        <div>
          <label className="rm-label">TIPO SESSIONE</label>
          <select className="rm-select" value={e.tipoSessione} onChange={(ev) => set("tipoSessione", ev.target.value as TimeLogData["tipoSessione"])}>
            {TIPI_SESSIONE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="rm-label">ENERGIA</label>
            <div className="flex gap-1.5 mt-1">
              {ENERGIE.map((en) => (
                <button key={en} onClick={() => set("energia", en)}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase transition-colors ${e.energia === en ? "bg-rm-accent text-black" : "border border-rm-border text-rm-muted hover:text-white"}`}>
                  {en.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="rm-label">FATTURABILE</label>
            <div className="flex gap-1.5 mt-1">
              {FATTURABILE_OPTS.map((f) => (
                <button key={f} onClick={() => set("fatturabile", f)}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase transition-colors ${e.fatturabile === f ? "bg-rm-accent text-black" : "border border-rm-border text-rm-muted hover:text-white"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-rm-border flex">
        <button onClick={onCancel} className="flex-1 py-3 text-xs text-rm-muted uppercase tracking-[0.12em] font-semibold border-r border-rm-border hover:text-white transition-colors">ANNULLA</button>
        <button onClick={() => onConfirm(e)} className="flex-[2] py-3 bg-rm-accent text-black text-xs font-black uppercase tracking-[0.1em] hover:bg-white transition-colors">SALVA TIME LOG</button>
      </div>
    </div>
  );
}
