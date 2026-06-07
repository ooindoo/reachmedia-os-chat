"use client";

import { useState } from "react";
import { CLIENT_NAMES, TIPI_SESSIONE, ENERGIE, FATTURABILE_OPTS } from "@/lib/clients";
import type { TimeLogData } from "@/lib/timelog";
import {
  EText, ENumber, EDate, ETime, ESelect, ToggleBtn,
  CardWrap, CardHeader, SectionLabel, SaveBtn, CancelBtn,
  CARD_LABEL, CARD_ROW,
} from "./card-fields";

interface Props {
  timelog: TimeLogData;
  onConfirm: (timelog: TimeLogData) => void;
  onCancel: () => void;
}

// Shortened labels for toggle groups
const ENERGIA_MAP: Record<string, string> = {
  "⚡ Alta":  "ALTA",
  "😐 Media": "MEDIA",
  "😴 Bassa": "BASSA",
};
const FATT_MAP: Record<string, string> = {
  "✅ Sì": "SÌ",
  "❌ No": "NO",
};

export default function TimeLogConfirmCard({ timelog, onConfirm, onCancel }: Props) {
  const [e, setE] = useState<TimeLogData>({ ...timelog });
  const set = <K extends keyof TimeLogData>(k: K, v: TimeLogData[K]) =>
    setE((p) => ({ ...p, [k]: v }));

  return (
    <CardWrap>
      <CardHeader title="TIME LOG" />

      <div className="flex flex-col gap-0 mb-4">

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>DESCRIZIONE</span>
          <EText
            value={e.descrizione}
            placeholder="descrizione sessione"
            onChange={(v) => set("descrizione", v)}
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>CLIENTE</span>
          <ESelect
            value={e.cliente}
            options={CLIENT_NAMES}
            onChange={(v) => set("cliente", v)}
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>ORE</span>
          <ENumber
            value={e.oreLavorate}
            step={0.5}
            min={0}
            onChange={(v) => set("oreLavorate", v)}
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>DATA</span>
          <EDate value={e.data} onChange={(v) => set("data", v)} />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>ORA INIZIO</span>
          <ETime value={e.ora} onChange={(v) => set("ora", v)} />
        </div>

        <div className={`flex items-start gap-2 pb-4`}>
          <span className={CARD_LABEL}>TIPO</span>
          <ESelect
            value={e.tipoSessione}
            options={TIPI_SESSIONE}
            withEmpty={false}
            onChange={(v) => set("tipoSessione", v as TimeLogData["tipoSessione"])}
          />
        </div>

      </div>

      {/* Energia */}
      <div className="mb-3">
        <SectionLabel>Energia</SectionLabel>
        <div className="flex gap-1.5">
          {ENERGIE.map((en) => (
            <ToggleBtn
              key={en}
              active={e.energia === en}
              label={ENERGIA_MAP[en] ?? en}
              onClick={() => set("energia", en)}
            />
          ))}
        </div>
      </div>

      {/* Fatturabile */}
      <div className="mb-5">
        <SectionLabel>Fatturabile</SectionLabel>
        <div className="flex gap-1.5">
          {FATTURABILE_OPTS.map((f) => (
            <ToggleBtn
              key={f}
              active={e.fatturabile === f}
              label={FATT_MAP[f] ?? f}
              onClick={() => set("fatturabile", f)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SaveBtn onClick={() => onConfirm(e)} label="SALVA" />
        <CancelBtn onClick={onCancel} />
      </div>
    </CardWrap>
  );
}
