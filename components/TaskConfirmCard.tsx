"use client";

import { useState } from "react";
import {
  CLIENT_NAMES, TIPI_ATTIVITA, PRIORITA,
  CANALE_OPTS, BLOCCATO_DA_OPTS, APPROVAZIONE_OPTS,
} from "@/lib/clients";
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
  // Auto-enable reminder if AI already extracted a time from the message
  const [reminderOn, setReminderOn] = useState(!!(task.reminderTime && task.reminderTime !== ""));

  const set = <K extends keyof TaskData>(k: K, v: TaskData[K]) =>
    setE((p) => ({ ...p, [k]: v }));

  const toggleReminder = () => {
    const next = !reminderOn;
    setReminderOn(next);
    if (!next) {
      setE((p) => ({ ...p, reminderDate: "", reminderTime: "" }));
    } else {
      setE((p) => ({
        ...p,
        reminderDate: p.reminderDate || p.deadline,
        reminderTime: p.reminderTime || "09:00", // default 9:00
      }));
    }
  };

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-4 space-y-3 max-w-sm w-full">
      <p className="text-xs text-zinc-400 uppercase tracking-widest font-semibold">📋 Conferma task</p>

      {/* Titolo */}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Titolo</label>
        <input
          className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-indigo-500 outline-none"
          value={e.titolo}
          onChange={(ev) => set("titolo", ev.target.value)}
        />
      </div>

      {/* Cliente + Deadline */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Cliente</label>
          <select
            className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-indigo-500 outline-none"
            value={e.cliente}
            onChange={(ev) => set("cliente", ev.target.value)}
          >
            <option value="">— Nessuno —</option>
            {CLIENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Deadline</label>
          <input
            type="date"
            className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-indigo-500 outline-none"
            value={e.deadline}
            onChange={(ev) => set("deadline", ev.target.value)}
          />
        </div>
      </div>

      {/* Tipo attività + Canale */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Tipo attività</label>
          <select
            className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-indigo-500 outline-none"
            value={e.tipoAttivita}
            onChange={(ev) => set("tipoAttivita", ev.target.value as TaskData["tipoAttivita"])}
          >
            {TIPI_ATTIVITA.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Canale</label>
          <select
            className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-indigo-500 outline-none"
            value={e.canale ?? ""}
            onChange={(ev) => set("canale", ev.target.value as TaskData["canale"] || undefined)}
          >
            <option value="">— Nessuno —</option>
            {CANALE_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Priorità chips */}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Priorità</label>
        <div className="flex gap-2">
          {PRIORITA.map((p) => (
            <button
              key={p}
              onClick={() => set("priorita", p)}
              className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                e.priorita === p
                  ? "border-indigo-500 bg-indigo-500/20 text-white"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Bloccato da + Approvazione */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Bloccato da</label>
          <select
            className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-indigo-500 outline-none"
            value={e.bloccatoDa ?? "➖ Non bloccato"}
            onChange={(ev) => set("bloccatoDa", ev.target.value as TaskData["bloccatoDa"])}
          >
            {BLOCCATO_DA_OPTS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Approvazione</label>
          <select
            className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-indigo-500 outline-none"
            value={e.approvazioneCliente ?? "➖ Non necessaria"}
            onChange={(ev) => set("approvazioneCliente", ev.target.value as TaskData["approvazioneCliente"])}
          >
            {APPROVAZIONE_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* ── Reminder ────────────────────────────────────────────────────── */}
      <div className="border-t border-zinc-700/50 pt-3">
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

        {reminderOn && (
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Data reminder</label>
              <input
                type="date"
                className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-indigo-700/60 focus:border-indigo-500 outline-none"
                value={e.reminderDate ?? ""}
                onChange={(ev) => set("reminderDate", ev.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Ora reminder</label>
              <input
                type="time"
                className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-indigo-700/60 focus:border-indigo-500 outline-none"
                value={e.reminderTime ?? ""}
                onChange={(ev) => set("reminderTime", ev.target.value)}
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
          onClick={() => onConfirm(e)}
          className="flex-1 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          Salva su Notion
        </button>
      </div>
    </div>
  );
}
