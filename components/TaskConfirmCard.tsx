"use client";

import { useState } from "react";
import { CLIENT_NAMES, TIPI_ATTIVITA, PRIORITA, CANALE_OPTS, BLOCCATO_DA_OPTS, APPROVAZIONE_OPTS } from "@/lib/clients";
import type { TaskData } from "@/lib/notion";

interface Props {
  task: TaskData;
  onConfirm: (task: TaskData) => void;
  onCancel: () => void;
}

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
    <div className="bg-rm-surface border border-rm-border w-full max-w-[480px]">
      {/* Header */}
      <div className="border-b border-rm-border px-4 py-3">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-rm-muted">📋 NUOVA TASK</span>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Titolo */}
        <div>
          <label className="rm-label">TITOLO</label>
          <input className="rm-input" value={e.titolo} onChange={(ev) => set("titolo", ev.target.value)} />
        </div>

        {/* Cliente + Deadline */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="rm-label">CLIENTE</label>
            <select className="rm-select" value={e.cliente} onChange={(ev) => set("cliente", ev.target.value)}>
              <option value="">— nessuno —</option>
              {CLIENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="rm-label">DEADLINE</label>
            <input type="date" className="rm-input" value={e.deadline} onChange={(ev) => set("deadline", ev.target.value)} />
          </div>
        </div>

        {/* Tipo + Canale */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="rm-label">TIPO ATTIVITÀ</label>
            <select className="rm-select" value={e.tipoAttivita} onChange={(ev) => set("tipoAttivita", ev.target.value as TaskData["tipoAttivita"])}>
              {TIPI_ATTIVITA.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="rm-label">CANALE</label>
            <select className="rm-select" value={e.canale ?? ""} onChange={(ev) => set("canale", ev.target.value as TaskData["canale"] || undefined)}>
              <option value="">— nessuno —</option>
              {CANALE_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Priorità */}
        <div>
          <label className="rm-label">PRIORITÀ</label>
          <div className="flex gap-2 mt-1">
            {PRIORITA.map((p) => (
              <button key={p} onClick={() => set("priorita", p)}
                className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wide transition-colors ${
                  e.priorita === p ? "bg-rm-accent text-black" : "border border-rm-border text-rm-muted hover:text-white"
                }`}
              >{p}</button>
            ))}
          </div>
        </div>

        {/* Bloccato + Approvazione */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="rm-label">BLOCCATO DA</label>
            <select className="rm-select" value={e.bloccatoDa ?? ""} onChange={(ev) => set("bloccatoDa", ev.target.value as TaskData["bloccatoDa"])}>
              {BLOCCATO_DA_OPTS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="rm-label">APPROVAZIONE</label>
            <select className="rm-select" value={e.approvazioneCliente ?? ""} onChange={(ev) => set("approvazioneCliente", ev.target.value as TaskData["approvazioneCliente"])}>
              {APPROVAZIONE_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Reminder */}
        <div className="border-t border-rm-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-rm-muted">
              {reminderOn ? "🔔" : "🔕"} REMINDER NOTIFICA
            </span>
            <button onClick={toggleReminder}
              className={`relative w-8 h-4 transition-colors ${reminderOn ? "bg-rm-accent" : "bg-rm-faint"}`}>
              <span className={`absolute top-0.5 w-3 h-3 bg-black transition-transform ${reminderOn ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
          {reminderOn && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="rm-label">DATA REMINDER</label>
                <input type="date" className="rm-input" value={e.reminderDate ?? ""} onChange={(ev) => set("reminderDate", ev.target.value)} />
              </div>
              <div>
                <label className="rm-label">ORA REMINDER</label>
                <input type="time" className="rm-input" value={e.reminderTime ?? ""} onChange={(ev) => set("reminderTime", ev.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-rm-border flex">
        <button onClick={onCancel}
          className="flex-1 py-3 text-xs text-rm-muted uppercase tracking-[0.12em] font-semibold border-r border-rm-border hover:text-white transition-colors">
          ANNULLA
        </button>
        <button onClick={() => onConfirm(e)}
          className="flex-[2] py-3 bg-rm-accent text-black text-xs font-black uppercase tracking-[0.1em] hover:bg-white transition-colors">
          SALVA SU NOTION
        </button>
      </div>
    </div>
  );
}
