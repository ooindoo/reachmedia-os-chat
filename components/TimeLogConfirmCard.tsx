"use client";

import { useState } from "react";
import { CLIENT_NAMES, TIPI_SESSIONE, ENERGIE, FATTURABILE_OPTS } from "@/lib/clients";
import type { TimeLogData } from "@/lib/timelog";

interface Props {
  timelog: TimeLogData;
  onConfirm: (timelog: TimeLogData) => void;
  onCancel: () => void;
}

const fi = "w-full bg-transparent text-white text-sm border-b border-[#333] focus:border-[#CCFF00] pb-0.5 placeholder-[#444]";
const fs = "w-full bg-transparent text-white text-sm border-b border-[#333] focus:border-[#CCFF00] pb-0.5 cursor-pointer rm-select-arrow";
const fl = "shrink-0 w-[110px] text-[11px] text-[#555] uppercase tracking-[0.08em] font-semibold leading-[1.4]";
const fr = "flex items-start gap-3 px-4 py-3 border-b border-[#1a1a1a]";

export default function TimeLogConfirmCard({ timelog, onConfirm, onCancel }: Props) {
  const [e, setE] = useState<TimeLogData>({ ...timelog });
  const set = <K extends keyof TimeLogData>(k: K, v: TimeLogData[K]) => setE((p) => ({ ...p, [k]: v }));

  return (
    <div className="bg-[#111111] border border-[#222] w-full max-w-[520px]">

      <div className="px-4 py-3 border-b border-[#1a1a1a]">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white">TIME LOG</span>
      </div>

      <div className={fr}>
        <span className={fl}>DESCRIZIONE</span>
        <input className={fi} value={e.descrizione} onChange={(ev) => set("descrizione", ev.target.value)} placeholder="descrizione sessione" />
      </div>

      <div className={fr}>
        <span className={fl}>CLIENTE</span>
        <select className={fs} value={e.cliente} onChange={(ev) => set("cliente", ev.target.value)}>
          <option value="">— nessuno —</option>
          {CLIENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className={fr}>
        <span className={fl}>ORE</span>
        <input
          type="number" step="0.5" min="0"
          className={fi}
          value={e.oreLavorate}
          onChange={(ev) => set("oreLavorate", parseFloat(ev.target.value) || 0)}
        />
      </div>

      <div className={fr}>
        <span className={fl}>DATA</span>
        <input type="date" className={fi} value={e.data} onChange={(ev) => set("data", ev.target.value)} />
      </div>

      <div className={fr}>
        <span className={fl}>ORA INIZIO</span>
        <input type="time" className={fi} value={e.ora} onChange={(ev) => set("ora", ev.target.value)} />
      </div>

      <div className={fr}>
        <span className={fl}>TIPO</span>
        <select className={fs} value={e.tipoSessione} onChange={(ev) => set("tipoSessione", ev.target.value as TimeLogData["tipoSessione"])}>
          {TIPI_SESSIONE.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* ENERGIA — badge buttons */}
      <div className={fr}>
        <span className={`${fl} pt-0.5`}>ENERGIA</span>
        <div className="flex flex-wrap gap-1.5">
          {ENERGIE.map((en) => (
            <button
              key={en}
              onClick={() => set("energia", en)}
              className={`px-2.5 py-[3px] text-[11px] font-black uppercase bg-[#1a1a1a] border border-[#333] transition-colors ${e.energia === en ? "text-[#CCFF00]" : "text-[#555]"}`}
            >
              {en.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* FATTURABILE — badge buttons */}
      <div className={fr}>
        <span className={`${fl} pt-0.5`}>FATTURABILE</span>
        <div className="flex gap-1.5">
          {FATTURABILE_OPTS.map((f) => (
            <button
              key={f}
              onClick={() => set("fatturabile", f)}
              className={`px-2.5 py-[3px] text-[11px] font-black uppercase bg-[#1a1a1a] border border-[#333] transition-colors ${e.fatturabile === f ? "text-[#CCFF00]" : "text-[#555]"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2">
        <button
          onClick={() => onConfirm(e)}
          className="w-full py-3 bg-[#CCFF00] text-black text-[11px] font-black uppercase tracking-[0.08em] hover:bg-white transition-colors"
        >
          SALVA TIME LOG
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
