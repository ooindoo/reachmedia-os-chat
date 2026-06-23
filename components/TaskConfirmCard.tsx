"use client";

import { useState } from "react";
import { ISTUDIOS_CLIENTS, TIPI_ATTIVITA, CANALE_OPTS, BLOCCATO_DA_OPTS, APPROVAZIONE_OPTS } from "@/lib/clients";
import type { TaskData } from "@/lib/notion";
import {
  EText, EDate, ESelect, EClientSelect, ToggleBtn,
  CardWrap, CardHeader, SectionLabel, SaveBtn, CancelBtn,
  CARD_LABEL, CARD_ROW,
} from "./card-fields";

interface Props {
  task: TaskData;
  onConfirm: (task: TaskData) => void;
  onCancel: () => void;
}

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

export default function TaskConfirmCard({ task, onConfirm, onCancel }: Props) {
  const [e, setE] = useState<TaskData>({
    ...task,
    bloccatoDa:          task.bloccatoDa          ?? "➖ Non bloccato",
    approvazioneCliente: task.approvazioneCliente  ?? "➖ Non necessaria",
    gcalReminder:        task.gcalReminder         ?? "none",
  });

  const set = <K extends keyof TaskData>(k: K, v: TaskData[K]) =>
    setE((p) => ({ ...p, [k]: v }));

  const isIStudios  = ISTUDIOS_CLIENTS.has(e.cliente);
  const withCalendar = !!e.gcalReminder && e.gcalReminder !== "none";

  return (
    <CardWrap>
      <CardHeader title="NUOVA TASK" />

      <div className="flex flex-col gap-0 mb-4">

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>TITOLO</span>
          <EText value={e.titolo} placeholder="titolo task" onChange={(v) => set("titolo", v)} />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>CLIENTE</span>
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <EClientSelect value={e.cliente} onChange={(v) => set("cliente", v)} />
            {isIStudios && (
              <span className="text-[10px] text-[#555] uppercase tracking-[0.08em] px-3">
                Fattura a: <span className="text-[#777]">iStudios</span>
              </span>
            )}
          </div>
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>DEADLINE</span>
          <EDate value={e.deadline} onChange={(v) => set("deadline", v)} />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>TIPO</span>
          <ESelect
            value={e.tipoAttivita}
            options={TIPI_ATTIVITA}
            withEmpty={false}
            onChange={(v) => set("tipoAttivita", v as TaskData["tipoAttivita"])}
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>CANALE</span>
          <ESelect
            value={e.canale ?? ""}
            options={CANALE_OPTS}
            placeholder="—"
            onChange={(v) => set("canale", (v || undefined) as TaskData["canale"])}
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>BLOCCATO</span>
          <ESelect
            value={e.bloccatoDa ?? ""}
            options={BLOCCATO_DA_OPTS}
            withEmpty={false}
            onChange={(v) => set("bloccatoDa", v as TaskData["bloccatoDa"])}
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>APPROV.</span>
          <ESelect
            value={e.approvazioneCliente ?? ""}
            options={APPROVAZIONE_OPTS}
            withEmpty={false}
            onChange={(v) => set("approvazioneCliente", v as TaskData["approvazioneCliente"])}
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>NOTE</span>
          <EText
            value={e.note ?? ""}
            placeholder="note libere…"
            onChange={(v) => set("note", v || undefined)}
          />
        </div>

        <div className={`flex items-start gap-2 pb-4`}>
          <span className={CARD_LABEL}>GMAIL</span>
          <EText
            value={e.linkGmail ?? ""}
            placeholder="link email…"
            onChange={(v) => set("linkGmail", v || undefined)}
          />
        </div>

      </div>

      {/* Priorità */}
      <div className="mb-3">
        <SectionLabel>Priorità</SectionLabel>
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

      {/* Google Cal — 5 buttons on one row */}
      <div className="mb-5">
        <SectionLabel>Google Cal · reminder</SectionLabel>
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

      <div className="flex flex-col gap-2">
        <SaveBtn onClick={() => onConfirm(e)} withCalendar={withCalendar} />
        <CancelBtn onClick={onCancel} />
      </div>
    </CardWrap>
  );
}
