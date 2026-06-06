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
    <div className="bg-zinc-800 border border-emerald-700/50 rounded-2xl p-4 space-y-3 max-w-sm w-full">
      <p className="text-xs text-emerald-400 uppercase tracking-widest font-semibold">⏱ Conferma time log</p>

      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Descrizione sessione</label>
        <input className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-emerald-500 outline-none"
          value={e.descrizione} onChange={(ev) => set("descrizione", ev.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Cliente</label>
          <select className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-emerald-500 outline-none"
            value={e.cliente} onChange={(ev) => set("cliente", ev.target.value)}>
            <option value="">— Nessuno —</option>
            {CLIENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Ore lavorate</label>
          <input type="number" step="0.5" min="0"
            className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-emerald-500 outline-none"
            value={e.oreLavorate} onChange={(ev) => set("oreLavorate", parseFloat(ev.target.value) || 0)} />
        </div>
      </div>

      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Data</label>
        <input type="date" className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-emerald-500 outline-none"
          value={e.data} onChange={(ev) => set("data", ev.target.value)} />
      </div>

      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Tipo sessione</label>
        <select className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-emerald-500 outline-none"
          value={e.tipoSessione} onChange={(ev) => set("tipoSessione", ev.target.value as TimeLogData["tipoSessione"])}>
          {TIPI_SESSIONE.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Energia</label>
          <div className="flex gap-1">
            {ENERGIE.map((en) => (
              <button key={en} onClick={() => set("energia", en)}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${e.energia === en ? "border-emerald-500 bg-emerald-500/20 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                {en.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Fatturabile</label>
          <div className="flex gap-1">
            {FATTURABILE_OPTS.map((f) => (
              <button key={f} onClick={() => set("fatturabile", f)}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${e.fatturabile === f ? "border-emerald-500 bg-emerald-500/20 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-sm text-zinc-400 border border-zinc-700 hover:border-zinc-500 transition-colors">Annulla</button>
        <button onClick={() => onConfirm(e)} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">Salva Time Log</button>
      </div>
    </div>
  );
}
