"use client";

import { useState } from "react";
import {
  CLIENT_NAMES, MESI, ANNI,
  STATI_PAGAMENTO, METODI_PAGAMENTO, TIPI_DOCUMENTO,
} from "@/lib/clients";
import type { InvoiceData } from "@/lib/invoice";
import { todayRome, shiftDate } from "@/lib/tz";
import {
  EText, ENumber, EDate, ESelect, EDualSelect,
  CardWrap, CardHeader, SaveBtn, CancelBtn,
  CARD_LABEL, CARD_ROW,
} from "./card-fields";

interface Props {
  invoice: InvoiceData;
  onConfirm: (invoice: InvoiceData) => void;
  onCancel: () => void;
}

export default function InvoiceConfirmCard({ invoice, onConfirm, onCancel }: Props) {
  const today = todayRome();
  const [e, setE] = useState<InvoiceData>({
    ...invoice,
    // Ensure dates always have a default so the picker shows something useful
    dataEmissione: invoice.dataEmissione || today,
    dataScadenza:  invoice.dataScadenza  || shiftDate(invoice.dataEmissione || today, 30),
  });
  const set = <K extends keyof InvoiceData>(k: K, v: InvoiceData[K]) =>
    setE((p) => ({ ...p, [k]: v }));

  return (
    <CardWrap>
      <CardHeader title="NUOVA FATTURA" />

      <div className="flex flex-col gap-0 mb-4">

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>DESCRIZIONE</span>
          <EText
            value={e.descrizione}
            placeholder="descrizione servizio"
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
          <span className={CARD_LABEL}>IMPORTO €</span>
          <ENumber
            value={e.importoLordo}
            step={0.01}
            min={0}
            onChange={(v) => set("importoLordo", v)}
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>PERIODO</span>
          <EDualSelect
            valueA={e.mese}
            optionsA={MESI}
            onChangeA={(v) => set("mese", v)}
            valueB={e.anno}
            optionsB={ANNI}
            onChangeB={(v) => set("anno", v)}
            widthB="w-[72px]"
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>DOCUMENTO</span>
          <ESelect
            value={e.tipoDocumento}
            options={TIPI_DOCUMENTO}
            withEmpty={false}
            onChange={(v) => set("tipoDocumento", v as InvoiceData["tipoDocumento"])}
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>STATO</span>
          <ESelect
            value={e.statoPagamento}
            options={STATI_PAGAMENTO}
            withEmpty={false}
            onChange={(v) => set("statoPagamento", v as InvoiceData["statoPagamento"])}
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>METODO</span>
          <ESelect
            value={e.metodoPagamento}
            options={METODI_PAGAMENTO}
            withEmpty={false}
            onChange={(v) => set("metodoPagamento", v as InvoiceData["metodoPagamento"])}
          />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>EMISSIONE</span>
          <EDate value={e.dataEmissione} onChange={(v) => set("dataEmissione", v)} />
        </div>

        <div className={CARD_ROW}>
          <span className={CARD_LABEL}>SCADENZA</span>
          <EDate value={e.dataScadenza} onChange={(v) => set("dataScadenza", v)} />
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

      <div className="flex flex-col gap-2">
        <SaveBtn onClick={() => onConfirm(e)} label="SALVA" />
        <CancelBtn onClick={onCancel} />
      </div>
    </CardWrap>
  );
}
