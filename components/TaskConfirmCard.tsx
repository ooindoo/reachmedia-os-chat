"use client";

import { useState } from "react";
import { CLIENT_NAMES, TIPI_ATTIVITA, PRIORITA, CANALE_OPTS, BLOCCATO_DA_OPTS, APPROVAZIONE_OPTS } from "@/lib/clients";
import type { TaskData } from "@/lib/notion";

interface Props {
  task: TaskData;
  onConfirm: (task: TaskData) => void;
  onCancel: () => void;
}

const fi = "w-full bg-transparent text-white text-sm border-b border-[#333] focus:border-[#CCFF00] pb-0.5 placeholder-[#444]";
const fs = "w-full bg-transparent text-white text-sm border-b border-[#333] focus:border-[#CCFF00] pb-0.5 cursor-pointer rm-select-arrow";
const fl = "shrink-0 w-[110px] text-[11px] text-[#555] uppercase tracking-[0.08em] font-semibold leading-[1.4]";
const fr = "flex items-start gap-3 px-4 py-3 border-b border-[#1a1a1a]";

export default function TaskConfirmCard({ task, onConfirm, onCancel }: Props) {
  const [e, setE] = useState<TaskData>({
    ...task,
    bloccatoDa: task.bloccatoDa ?? "➖ Non bloccato",
    approvazioneCliente: task.approvazioneCliente ?? "➖ Non necessaria",
    reminderDate: task.reminderDate ?? "",
    reminderTime: task.reminderTime ?? "",
  });
  const [reminderOn, setReminderOn] = useState(!!(task.reminderTime && task.reminderTime !== ""));
  const set = <K extends keyof TaskData>(k: K, v: TaskData[K]) => setE((p) => ({ ...p, [k]: v }));

  const toggleReminder = () => {
    const next = !reminderOn;
    setReminderOn(next);
    if (!next) setE((p) => ({ ...p, reminderDate: "", reminderTime: "" }));
    else setE((p) => ({ ...p, reminderDate: p.reminderDate || p.deadline, reminderTime: p.reminderTime || "09:00" }));
  };

  return (
    <div className="bg-[#111111] border border-[#222] w-full max-w-[520px]">

      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a1a]">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white">NUOVA TASK</span>
      </div>

      {/* TITOLO */}
      <div className={fr}>
        <span className={fl}>TITOLO</span>
        <input className={fi} value={e.titolo} onChange={(ev) => set("titolo", ev.target.value)} placeholder="titolo task" />
      </div>

      {/* CLIENTE */}
      <div className={fr}>
        <span className={fl}>CLIENTE</span>
        <select className={fs} value={e.cliente} onChange={(ev) => set("cliente", ev.target.value)}>
          <option value="">— nessuno —</option>
          {CLIENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* DEADLINE */}
      <div className={fr}>
        <span className={fl}>DEADLINE</span>
        <input type="date" className={fi} value={e.deadline} onChange={(ev) => set("deadline", ev.target.value)} />
      </div>

      {/* TIPO ATTIVITÀ */}
      <div className={fr}>
        <span className={fl}>TIPO</span>
        <select className={fs} value={e.tipoAttivita} onChange={(ev) => set("tipoAttivita", ev.target.value as TaskData["tipoAttivita"])}>
          {TIPI_ATTIVITA.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* PRIORITÀ — badge buttons */}
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

      {/* CANALE */}
      <div className={fr}>
        <span className={fl}>CANALE</span>
        <select className={fs} value={e.canale ?? ""} onChange={(ev) => set("canale", (ev.target.value as TaskData["canale"]) || undefined)}>
          <option value="">— nessuno —</option>
          {CANALE_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* BLOCCATO DA */}
      <div className={fr}>
        <span className={fl}>BLOCCATO</span>
        <select className={fs} value={e.bloccatoDa ?? ""} onChange={(ev) => set("bloccatoDa", ev.target.value as TaskData["bloccatoDa"])}>
          {BLOCCATO_DA_OPTS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* APPROVAZIONE */}
      <div className={fr}>
        <span className={fl}>APPROV.</span>
        <select className={fs} value={e.approvazioneCliente ?? ""} onChange={(ev) => set("approvazioneCliente", ev.target.value as TaskData["approvazioneCliente"])}>
          {APPROVAZIONE_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* REMINDER */}
      <div className={`${fr} items-center`}>
        <span className={fl}>REMINDER</span>
        <div className="flex items-center gap-3 flex-1 flex-wrap min-w-0">
          <button
            onClick={toggleReminder}
            className={`relative w-8 h-4 shrink-0 transition-colors ${reminderOn ? "bg-[#CCFF00]" : "bg-[#222]"}`}
          >
            <span className={`absolute top-0.5 w-3 h-3 bg-black transition-all ${reminderOn ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
          {reminderOn && (
            <>
              <input
                type="date"
                className="flex-1 min-w-0 bg-transparent text-white text-sm border-b border-[#333] focus:border-[#CCFF00] pb-0.5"
                value={e.reminderDate ?? ""}
                onChange={(ev) => set("reminderDate", ev.target.value)}
              />
              <input
                type="time"
                className="w-[88px] bg-transparent text-white text-sm border-b border-[#333] focus:border-[#CCFF00] pb-0.5"
                value={e.reminderTime ?? ""}
                onChange={(ev) => set("reminderTime", ev.target.value)}
              />
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 flex flex-col gap-2">
        <button
          onClick={() => onConfirm(e)}
          className="w-full py-3 bg-[#CCFF00] text-black text-[11px] font-black uppercase tracking-[0.08em] hover:bg-white transition-colors"
        >
          SALVA SU NOTION
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
