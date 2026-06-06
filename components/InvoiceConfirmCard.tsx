"use client";

import { useState } from "react";
import { CLIENT_NAMES, MESI, ANNI, STATI_PAGAMENTO, METODI_PAGAMENTO, TIPI_DOCUMENTO } from "@/lib/clients";
import type { InvoiceData } from "@/lib/invoice";

interface Props {
  invoice: InvoiceData;
  onConfirm: (invoice: InvoiceData) => void;
  onCancel: () => void;
}

const fi = "w-full bg-transparent text-white text-sm border-b border-[#333] focus:border-[#CCFF00] pb-0.5 placeholder-[#444]";
const fs = "w-full bg-transparent text-white text-sm border-b border-[#333] focus:border-[#CCFF00] pb-0.5 cursor-pointer rm-select-arrow";
const fl = "shrink-0 w-[110px] text-[11px] text-[#555] uppercase tracking-[0.08em] font-semibold leading-[1.4]";
const fr = "flex items-start gap-3 px-4 py-3 border-b border-[#1a1a1a]";

export default function InvoiceConfirmCard({ invoice, onConfirm, onCancel }: Props) {
  const [e, setE] = useState<InvoiceData>({ ...invoice });
  const set = <K extends keyof InvoiceData>(k: K, v: InvoiceData[K]) => setE((p) => ({ ...p, [k]: v }));

  return (
    <div className="bg-[#111111] border border-[#222] w-full max-w-[520px]">

      <div className="px-4 py-3 border-b border-[#1a1a1a]">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white">NUOVA FATTURA</span>
      </div>

      <div className={fr}>
        <span className={fl}>DESCRIZIONE</span>
        <input className={fi} value={e.descrizione} onChange={(ev) => set("descrizione", ev.target.value)} placeholder="descrizione servizio" />
      </div>

      <div className={fr}>
        <span className={fl}>CLIENTE</span>
        <select className={fs} value={e.cliente} onChange={(ev) => set("cliente", ev.target.value)}>
          <option value="">— nessuno —</option>
          {CLIENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className={fr}>
        <span className={fl}>IMPORTO €</span>
        <input
          type="number" min="0" step="0.01"
          className={fi}
          value={e.importoLordo}
          onChange={(ev) => set("importoLordo", parseFloat(ev.target.value) || 0)}
        />
      </div>

      <div className={fr}>
        <span className={fl}>PERIODO</span>
        <div className="flex gap-2 flex-1 min-w-0">
          <select className={`${fs} flex-1`} value={e.mese} onChange={(ev) => set("mese", ev.target.value as InvoiceData["mese"])}>
            {MESI.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className={`${fs} w-[72px] shrink-0`} value={e.anno} onChange={(ev) => set("anno", ev.target.value as InvoiceData["anno"])}>
            {ANNI.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className={fr}>
        <span className={fl}>DOCUMENTO</span>
        <select className={fs} value={e.tipoDocumento} onChange={(ev) => set("tipoDocumento", ev.target.value as InvoiceData["tipoDocumento"])}>
          {TIPI_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className={fr}>
        <span className={fl}>STATO</span>
        <select className={fs} value={e.statoPagamento} onChange={(ev) => set("statoPagamento", ev.target.value as InvoiceData["statoPagamento"])}>
          {STATI_PAGAMENTO.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className={fr}>
        <span className={fl}>METODO</span>
        <select className={fs} value={e.metodoPagamento} onChange={(ev) => set("metodoPagamento", ev.target.value as InvoiceData["metodoPagamento"])}>
          {METODI_PAGAMENTO.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className={fr}>
        <span className={fl}>EMISSIONE</span>
        <input type="date" className={fi} value={e.dataEmissione} onChange={(ev) => set("dataEmissione", ev.target.value)} />
      </div>

      <div className={fr}>
        <span className={fl}>SCADENZA</span>
        <input type="date" className={fi} value={e.dataScadenza} onChange={(ev) => set("dataScadenza", ev.target.value)} />
      </div>

      <div className="p-4 flex flex-col gap-2">
        <button
          onClick={() => onConfirm(e)}
          className="w-full py-3 bg-[#CCFF00] text-black text-[11px] font-black uppercase tracking-[0.08em] hover:bg-white transition-colors"
        >
          SALVA FATTURA
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
