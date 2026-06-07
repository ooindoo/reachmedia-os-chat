/**
 * Shared field primitives for all confirm-card components.
 * Every editable field uses the same hover / focus-within treatment:
 *   idle        → transparent bg, transparent left-border
 *   hover       → #1a1a1a bg, #CCFF00 left-border (2px)
 *   focus-within → same, persists while typing / dropdown open
 *
 * Date / time / select all use an invisible native element that covers the
 * visible display div. The native element receives the real click so pickers
 * open on the first tap/click with no JavaScript involved.
 * CSS :hover propagates from child to ancestor, so the wrapper div's hover
 * styles fire correctly even though the native element is on top.
 */

"use client";

import { type ReactNode } from "react";
import { CLIENT_GROUPS } from "@/lib/clients";

// ── Shared class tokens ────────────────────────────────────────────────────────
// Applied to every editable field wrapper or directly to native inputs
const FW =
  "flex-1 relative border-l-2 border-l-transparent " +
  "hover:bg-[#1a1a1a] hover:border-l-[#CCFF00] " +
  "focus-within:bg-[#1a1a1a] focus-within:border-l-[#CCFF00] " +
  "transition-all duration-150";

export const CARD_LABEL =
  "w-[80px] shrink-0 text-[11px] text-[#555] " +
  "uppercase tracking-[0.08em] font-semibold leading-[1.4]";

export const CARD_ROW =
  "flex items-start gap-2 pb-4 border-b border-[#1a1a1a]";

// Minimum row height satisfying 44 px iOS touch-target requirement
const MIN_ROW_H = "min-h-[44px]";

// ── Text input ────────────────────────────────────────────────────────────────
// Always visible — single click = instant focus, no toggle needed.
// font-size 16px prevents iOS auto-zoom.
export function EText({
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
      className={
        `${FW} flex-1 text-white text-sm px-3 ${MIN_ROW_H} ` +
        `flex items-center cursor-text outline-none placeholder-[#444] leading-snug`
      }
      style={{ fontSize: "16px" }}
    />
  );
}

// ── Number input ──────────────────────────────────────────────────────────────
export function ENumber({
  value, step = 1, min = 0, onChange,
}: {
  value: number; step?: number; min?: number; onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value || ""}
      step={step}
      min={min}
      inputMode="decimal"
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={
        `${FW} flex-1 text-white text-sm px-3 ${MIN_ROW_H} ` +
        `flex items-center cursor-text outline-none placeholder-[#444] leading-snug`
      }
      style={{ fontSize: "16px" }}
    />
  );
}

// ── Date picker ───────────────────────────────────────────────────────────────
// The hidden <input type="date"> sits absolute inset-0, so native pickers
// open on the very first tap — no JS needed.
// 📅 emoji is pointer-events-none → click passes through to the date input.
export function EDate({
  value, onChange,
}: {
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className={`${FW} flex-1 cursor-pointer`}>
      {/* Visible row */}
      <div className={`flex items-center justify-between px-3 ${MIN_ROW_H} pointer-events-none select-none gap-2`}>
        <span className="text-sm text-white" style={{ fontSize: "16px" }}>
          {value || <span className="text-[#444]">—</span>}
        </span>
        <span className="text-[#444] text-[14px] shrink-0">📅</span>
      </div>
      {/* Native date input — transparent, full coverage */}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        style={{ colorScheme: "dark", fontSize: "16px" }}
      />
    </div>
  );
}

// ── Time picker ───────────────────────────────────────────────────────────────
export function ETime({
  value, onChange,
}: {
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className={`${FW} flex-1 cursor-pointer`}>
      <div className={`flex items-center justify-between px-3 ${MIN_ROW_H} pointer-events-none select-none gap-2`}>
        <span className="text-sm text-white" style={{ fontSize: "16px" }}>
          {value || <span className="text-[#444]">—</span>}
        </span>
        <span className="text-[#444] text-[14px] shrink-0">🕐</span>
      </div>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        style={{ colorScheme: "dark", fontSize: "16px" }}
      />
    </div>
  );
}

// ── Generic select ────────────────────────────────────────────────────────────
// Hidden <select> covers the wrapper → native dropdown opens on first click.
export function ESelect({
  value, options, onChange, placeholder = "—", withEmpty = true,
}: {
  value: string;
  options: readonly string[] | string[];
  onChange: (v: string) => void;
  placeholder?: string;
  withEmpty?: boolean;
}) {
  return (
    <div className={`${FW} flex-1 cursor-pointer`}>
      <div className={`px-3 ${MIN_ROW_H} flex items-center pointer-events-none select-none`}>
        <span className="text-sm text-white leading-snug" style={{ fontSize: "16px" }}>
          {value || <span className="text-[#444]">{placeholder}</span>}
        </span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
      >
        {withEmpty && <option value="">— nessuno —</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// ── Grouped client select (Diretti / iStudios optgroups) ─────────────────────
export function EClientSelect({
  value, onChange,
}: {
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className={`${FW} flex-1 cursor-pointer`}>
      <div className={`px-3 ${MIN_ROW_H} flex items-center pointer-events-none select-none`}>
        <span className="text-sm text-white leading-snug" style={{ fontSize: "16px" }}>
          {value || <span className="text-[#444]">—</span>}
        </span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
      >
        <option value="">— nessuno —</option>
        {CLIENT_GROUPS.map((g) => (
          <optgroup
            key={g.group}
            label={g.group === "iStudios" ? "── iStudios" : "── Diretti"}
          >
            {g.clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

// ── Dual select (e.g. Mese + Anno on same row) ─────────────────────────────
export function EDualSelect<A extends string, B extends string>({
  valueA, optionsA, onChangeA,
  valueB, optionsB, onChangeB,
  widthB = "w-[72px]",
}: {
  valueA: A; optionsA: readonly string[]; onChangeA: (v: A) => void;
  valueB: B; optionsB: readonly string[]; onChangeB: (v: B) => void;
  widthB?: string;
}) {
  return (
    <div className="flex-1 flex gap-2 min-w-0">
      <ESelect
        value={valueA}
        options={optionsA}
        onChange={(v) => onChangeA(v as A)}
        withEmpty={false}
      />
      <div className={`${FW} ${widthB} shrink-0 cursor-pointer`}>
        <div className={`px-3 ${MIN_ROW_H} flex items-center pointer-events-none select-none`}>
          <span className="text-sm text-white" style={{ fontSize: "16px" }}>{valueB}</span>
        </div>
        <select
          value={valueB}
          onChange={(e) => onChangeB(e.target.value as B)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        >
          {optionsB.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Toggle button — Priorità, GCAL, Energia, Fatturabile ──────────────────────
export function ToggleBtn({
  active, label, onClick,
}: {
  active: boolean; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex-1 py-2 text-[11px] font-black uppercase tracking-[0.05em]",
        "border transition-all duration-150 whitespace-nowrap cursor-pointer min-h-[40px]",
        active
          ? "bg-[#CCFF00] text-black border-[#CCFF00]"
          : "bg-transparent border-[#2a2a2a] text-[#555]",
        !active ? "hover:bg-[#1a1a1a] hover:border-[#CCFF00] hover:text-white" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ── Card container ────────────────────────────────────────────────────────────
// Responsive padding: 16px mobile → 20px tablet → 24px desktop
export function CardWrap({ children }: { children: ReactNode }) {
  return (
    <div className="rm-card bg-[#111111] border border-[#222] w-full max-w-[560px] p-4 md:p-5 lg:p-6 flex flex-col gap-0">
      {children}
    </div>
  );
}

// ── Card header ───────────────────────────────────────────────────────────────
export function CardHeader({ title }: { title: string }) {
  return (
    <div className="pb-4 mb-4 border-b border-[#1a1a1a]">
      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white">
        {title}
      </span>
    </div>
  );
}

// ── Section label (above toggle button groups) ────────────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[11px] text-[#555] uppercase tracking-[0.08em] font-semibold mb-2">
      {children}
    </span>
  );
}

// ── Notion "N" icon — minimal stroke ─────────────────────────────────────────
export function NotionIcon() {
  return (
    <svg
      width="14" height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {/* Stylized "N" */}
      <path d="M2 2v10M2 2l9 10M11 2v10" />
    </svg>
  );
}

// ── Calendar icon — minimal stroke with "31" ──────────────────────────────────
export function CalendarIcon() {
  return (
    <svg
      width="14" height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      style={{ flexShrink: 0 }}
    >
      <rect x="1" y="2.5" width="14" height="12" />
      <line x1="1" y1="6.5" x2="15" y2="6.5" />
      <line x1="5" y1="0.5" x2="5" y2="4.5" />
      <line x1="11" y1="0.5" x2="11" y2="4.5" />
      <text x="8" y="13" textAnchor="middle" fontSize="4.5" fontWeight="700" fill="currentColor" stroke="none">31</text>
    </svg>
  );
}

// ── Save button ───────────────────────────────────────────────────────────────
// Always shows NotionIcon. CalendarIcon shown only when withCalendar=true.
export function SaveBtn({
  onClick, label = "SALVA", withCalendar = false,
}: {
  onClick: () => void; label?: string; withCalendar?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 bg-[#CCFF00] text-black text-[11px] font-black uppercase tracking-[0.1em] hover:bg-white transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
    >
      <NotionIcon />
      {withCalendar && <CalendarIcon />}
      <span>{label}</span>
    </button>
  );
}

// ── Cancel button ─────────────────────────────────────────────────────────────
export function CancelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 bg-transparent border border-[#222] text-[#444] text-[11px] uppercase tracking-[0.08em] font-semibold hover:border-[#444] hover:text-[#888] transition-all duration-150 cursor-pointer min-h-[44px]"
    >
      ANNULLA
    </button>
  );
}
