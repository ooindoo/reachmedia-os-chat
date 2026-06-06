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
  const [edited, setEdited] = useState<TaskData>({
    ...task,
    reminderDate: task.reminderDate ?? "",
    reminderTime: task.reminderTime ?? "",
  });
  const [reminderOn, setReminderOn] = useState(false);

  const set = <K extends keyof TaskData>(key: K, value: TaskData[K]) =>
    setEdited((prev) => ({ ...prev, [key]: value }));

  const toggleReminder = () => {
    const next = !reminderOn;
    setReminderOn(next);
    if (!next) {
      setEdited((p) => ({ ...p, reminderDate: "", reminderTime: "" }));
    } else {
      // Pre-fill with deadline date and 09:00
      setEdited((p) => ({
        ...p,
        reminderDate: p.reminderDate || p.deadline,
        reminderTime: p.reminderTime || "09:00",
      }));
    }
  };

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
          {CLIENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
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
          {TIPI_ATTIVITA.map((t) => <option key={t} value={t}>{t}</option>)}
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

      {/* ── Reminder ─────────────────────────────────────────────────────── */}
      <div className="border-t border-zinc-700/50 pt-3">
        {/* Toggle row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{reminderOn ? "🔔" : "🔕"}</span>
            <span className="text-xs text-zinc-300 font-medium">Reminder notifica</span>
          </div>
          <button
            onClick={toggleReminder}
            className={`relative w-9 h-5 rounded-full transition-colors ${reminderOn ? "bg-indigo-600" : "bg-zinc-600"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${reminderOn ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Date + time pickers — shown only when toggle is on */}
        {reminderOn && (
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Data reminder</label>
              <input
                type="date"
                className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-indigo-700/60 focus:border-indigo-500 outline-none"
                value={edited.reminderDate ?? ""}
                onChange={(e) => set("reminderDate", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Ora reminder</label>
              <input
                type="time"
                className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-indigo-700/60 focus:border-indigo-500 outline-none"
                value={edited.reminderTime ?? ""}
                onChange={(e) => set("reminderTime", e.target.value)}
              />
            </div>
          </div>
        )}
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
