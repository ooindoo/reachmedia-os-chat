"use client";

import { useRef, useState } from "react";
import {
  CLIENT_GROUPS, ISTUDIOS_CLIENTS,
  TIPI_ATTIVITA, CANALE_OPTS, BLOCCATO_DA_OPTS, APPROVAZIONE_OPTS,
} from "@/lib/clients";
import type { TaskData } from "@/lib/notion";

interface Props {
  task: TaskData;
  onConfirm: (task: TaskData) => void;
  onCancel: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const PRIO = [
  { value: "🔴 Urgente" as const, label: "URGENTE" },
  { value: "🟡 Media"   as const, label: "MEDIA" },
  { value: "🟢 Bassa"   as const, label: "BASSA" },
];

const GCAL = [
  { value: "none"     as const, label: "NESSUNO" },
  { value: "same_day" as const, label: "OGGI" },
  { value: "1_day"    as const, label: "-1G" },
  { value: "2_days"   as const, label: "-2G" },
  { value: "1_week"   as const, label: "-1W" },
];

// ── Shared classes ─────────────────────────────────────────────────────────────
// All editable fields use the same hover/focus treatment:
//   idle   → transparent bg, transparent left-border
//   hover  → #1a1a1a bg, #CCFF00 left-border (2px)
//   focus  → same as hover, persists while editing
const F =
  "flex-1 w-full bg-transparent text-white text-sm " +
  "border-l-2 border-l-transparent " +
  "hover:bg-[#1a1a1a] hover:border-l-[#CCFF00] " +
  "focus:bg-[#1a1a1a] focus:border-l-[#CCFF00] " +
  "outline-none cursor-pointer transition-all duration-150 " +
  "px-3 py-[6px] leading-snug";

// Label column
const LBL =
  "w-[80px] shrink-0 text-[11px] text-[#555] " +
  "uppercase tracking-[0.08em] font-semibold pt-[7px] leading-[1.4]";

// Row
const ROW = "flex items-start gap-2 pb-4 border-b border-[#1a1a1a]";

// ── Editable text (title) ──────────────────────────────────────────────────────
// Native input always present — single click focuses it
function EText({
  value, placeholder = "—", onChange,
}: {
  value: string; placeholder?: string; onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${F} placeholder-[#444] cursor-text`}
    />
  );
}

// ── Editable date ──────────────────────────────────────────────────────────────
// Hidden date input + visible text overlay. Click on wrapper calls showPicker()
// synchronously within user gesture → opens native picker immediately.
function EDate({
  value, onChange,
}: {
  value: string; onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const open = () => {
    if (!ref.current) return;
    try {
      (ref.current as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      ref.current.click();
    }
  };

  return (
    // Wrapper gets the hover styles; select is pointer-events-none so
    // hover fires on wrapper, not intercepted by child.
    <div
      onClick={open}
      className={
        "flex-1 relative border-l-2 border-l-transparent " +
        "hover:bg-[#1a1a1a] hover:border-l-[#CCFF00] " +
        "cursor-pointer transition-all duration-150"
      }
    >
      {/* Visible label */}
      <div className="px-3 py-[6px] text-sm text-white pointer-events-none select-none leading-snug">
        {value || <span className="text-[#444]">—</span>}
      </div>
      {/* Native date input — transparent, covers wrapper for native open trigger */}
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        style={{ colorScheme: "dark" }}
      />
    </div>
  );
}

// ── Editable select ────────────────────────────────────────────────────────────
// Same pattern: wrapper captures hover, hidden select opens on wrapper click.
function ESelect({
  value, options, onChange, placeholder = "—",
}: {
  value: string;
  options: readonly string[] | string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  return (
    <div
      onClick={() => ref.current?.click()}
      className={
        "flex-1 relative border-l-2 border-l-transparent " +
        "hover:bg-[#1a1a1a] hover:border-l-[#CCFF00] " +
        "cursor-pointer transition-all duration-150"
      }
    >
      <div className="px-3 py-[6px] text-sm text-white pointer-events-none select-none leading-snug">
        {value || <span className="text-[#444]">{placeholder}</span>}
      </div>
      <select
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
      >
        <option value="">— nessuno —</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// ── Editable client select (grouped optgroups) ─────────────────────────────────
function EClientSelect({
  value, onChange,
}: {
  value: string; onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  return (
    <div
      onClick={() => ref.current?.click()}
      className={
        "flex-1 relative border-l-2 border-l-transparent " +
        "hover:bg-[#1a1a1a] hover:border-l-[#CCFF00] " +
        "cursor-pointer transition-all duration-150"
      }
    >
      <div className="px-3 py-[6px] text-sm text-white pointer-events-none select-none leading-snug">
        {value || <span className="text-[#444]">—</span>}
      </div>
      <select
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
      >
        <option value="">— nessuno —</option>
        {CLIENT_GROUPS.map((g) => (
          <optgroup key={g.group} label={g.group === "iStudios" ? "── iStudios" : "── Diretti"}>
            {g.clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

// ── Toggle button — Priorità & GCAL ───────────────────────────────────────────
function ToggleBtn({
  active, label, onClick,
}: {
  active: boolean; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex-1 py-[7px] text-[11px] font-black uppercase tracking-[0.06em]",
        "border transition-all duration-150 whitespace-nowrap cursor-pointer",
        active
          ? "bg-[#CCFF00] text-black border-[#CCFF00]"
          : "bg-transparent border-[#2a2a2a] text-[#555] hover:bg-[#1a1a1a] hover:border-[#CCFF00] hover:text-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ── Save / Cancel icons ────────────────────────────────────────────────────────
function NotionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.82 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933l3.222-.187z" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TaskConfirmCard({ task, onConfirm, onCancel }: Props) {
  const [e, setE] = useState<TaskData>({
    ...task,
    bloccatoDa: task.bloccatoDa ?? "➖ Non bloccato",
    approvazioneCliente: task.approvazioneCliente ?? "➖ Non necessaria",
    gcalReminder: task.gcalReminder ?? "none",
  });

  const set = <K extends keyof TaskData>(k: K, v: TaskData[K]) =>
    setE((p) => ({ ...p, [k]: v }));

  const isIStudios = ISTUDIOS_CLIENTS.has(e.cliente);
  const withCalendar = !!e.gcalReminder && e.gcalReminder !== "none";

  return (
    <div className="rm-card bg-[#111111] border border-[#222] w-full max-w-[560px] p-6 flex flex-col gap-0">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="pb-4 mb-4 border-b border-[#1a1a1a]">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white">
          NUOVA TASK
        </span>
      </div>

      {/* ── Fields ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0 mb-4">

        {/* TITOLO */}
        <div className={ROW}>
          <span className={LBL}>TITOLO</span>
          <EText
            value={e.titolo}
            placeholder="titolo task"
            onChange={(v) => set("titolo", v)}
          />
        </div>

        {/* CLIENTE */}
        <div className={ROW}>
          <span className={LBL}>CLIENTE</span>
          <div className="flex-1 flex flex-col gap-1">
            <EClientSelect value={e.cliente} onChange={(v) => set("cliente", v)} />
            {isIStudios && (
              <span className="text-[10px] text-[#555] uppercase tracking-[0.08em] px-3">
                Fattura a: <span className="text-[#777]">iStudios</span>
              </span>
            )}
          </div>
        </div>

        {/* DEADLINE */}
        <div className={ROW}>
          <span className={LBL}>DEADLINE</span>
          <EDate value={e.deadline} onChange={(v) => set("deadline", v)} />
        </div>

        {/* TIPO */}
        <div className={ROW}>
          <span className={LBL}>TIPO</span>
          <ESelect
            value={e.tipoAttivita}
            options={TIPI_ATTIVITA}
            onChange={(v) => set("tipoAttivita", v as TaskData["tipoAttivita"])}
          />
        </div>

        {/* CANALE */}
        <div className={ROW}>
          <span className={LBL}>CANALE</span>
          <ESelect
            value={e.canale ?? ""}
            options={CANALE_OPTS}
            placeholder="—"
            onChange={(v) => set("canale", (v || undefined) as TaskData["canale"])}
          />
        </div>

        {/* BLOCCATO */}
        <div className={ROW}>
          <span className={LBL}>BLOCCATO</span>
          <ESelect
            value={e.bloccatoDa ?? ""}
            options={BLOCCATO_DA_OPTS}
            onChange={(v) => set("bloccatoDa", v as TaskData["bloccatoDa"])}
          />
        </div>

        {/* APPROVAZIONE */}
        <div className={`flex items-start gap-2 pb-4`}>
          <span className={LBL}>APPROV.</span>
          <ESelect
            value={e.approvazioneCliente ?? ""}
            options={APPROVAZIONE_OPTS}
            onChange={(v) => set("approvazioneCliente", v as TaskData["approvazioneCliente"])}
          />
        </div>

      </div>

      {/* ── Priorità ────────────────────────────────────────────────────────── */}
      <div className="mb-3">
        <span className="block text-[11px] text-[#555] uppercase tracking-[0.08em] font-semibold mb-2">
          Priorità
        </span>
        <div className="flex gap-1.5">
          {PRIO.map((p) => (
            <ToggleBtn
              key={p.value}
              active={e.priorita === p.value}
              label={p.label}
              onClick={() => set("priorita", p.value)}
            />
          ))}
        </div>
      </div>

      {/* ── Google Cal — 5 buttons on one row ───────────────────────────────── */}
      <div className="mb-5">
        <span className="block text-[11px] text-[#555] uppercase tracking-[0.08em] font-semibold mb-2">
          Google Cal · reminder
        </span>
        <div className="flex gap-1.5">
          {GCAL.map((opt) => (
            <ToggleBtn
              key={opt.value}
              active={e.gcalReminder === opt.value}
              label={opt.label}
              onClick={() => set("gcalReminder", opt.value)}
            />
          ))}
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onConfirm(e)}
          className="w-full py-3 bg-[#CCFF00] text-black text-[11px] font-black uppercase tracking-[0.1em] hover:bg-white transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer"
        >
          <NotionIcon />
          <span>SALVA</span>
          {withCalendar && <CalIcon />}
        </button>
        <button
          onClick={onCancel}
          className="w-full py-[11px] bg-transparent border border-[#2a2a2a] text-[#555] text-[11px] uppercase tracking-[0.08em] font-semibold hover:border-[#555] hover:text-[#999] transition-all duration-150 cursor-pointer"
        >
          ANNULLA
        </button>
      </div>

    </div>
  );
}
