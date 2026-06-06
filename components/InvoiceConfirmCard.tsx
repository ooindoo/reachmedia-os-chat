"use client";

import { useState } from "react";
import { CLIENT_NAMES, MESI, ANNI, STATI_PAGAMENTO, METODI_PAGAMENTO, TIPI_DOCUMENTO } from "@/lib/clients";
import type { InvoiceData } from "@/lib/invoice";

interface Props {
  invoice: InvoiceData;
  onConfirm: (invoice: InvoiceData) => void;
  onCancel: () => void;
}

export default function InvoiceConfirmCard({ invoice, onConfirm, onCancel }: Props) {
  const [e, setE] = useState<InvoiceData>({ ...invoice });
  const set = <K extends keyof InvoiceData>(k: K, v: InvoiceData[K]) => setE((p) => ({ ...p, [k]: v }));

  return (
    <div className="bg-rm-surface border border-rm-border w-full max-w-[480px]">
      <div className="border-b border-rm-border px-4 py-3">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-rm-muted">📄 NUOVA FATTURA</span>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div>
          <label className="rm-label">DESCRIZIONE</label>
          <input className="rm-input" value={e.descrizione} onChange={(ev) => set("descrizione", ev.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="rm-label">CLIENTE</label>
            <select className="rm-select" value={e.cliente} onChange={(ev) => set("cliente", ev.target.value)}>
              <option value="">— nessuno —</option>
              {CLIENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="rm-label">IMPORTO LORDO €</label>
            <input type="number" min="0" step="0.01" className="rm-input"
              value={e.importoLordo} onChange={(ev) => set("importoLordo", parseFloat(ev.target.value) || 0)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="rm-label">MESE</label>
            <select className="rm-select" value={e.mese} onChange={(ev) => set("mese", ev.target.value as InvoiceData["mese"])}>
              {MESI.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="rm-label">ANNO</label>
            <select className="rm-select" value={e.anno} onChange={(ev) => set("anno", ev.target.value as InvoiceData["anno"])}>
              {ANNI.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="rm-label">DOCUMENTO</label>
            <select className="rm-select" value={e.tipoDocumento} onChange={(ev) => set("tipoDocumento", ev.target.value as InvoiceData["tipoDocumento"])}>
              {TIPI_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="rm-label">STATO PAGAMENTO</label>
            <select className="rm-select" value={e.statoPagamento} onChange={(ev) => set("statoPagamento", ev.target.value as InvoiceData["statoPagamento"])}>
              {STATI_PAGAMENTO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="rm-label">METODO</label>
            <select className="rm-select" value={e.metodoPagamento} onChange={(ev) => set("metodoPagamento", ev.target.value as InvoiceData["metodoPagamento"])}>
              {METODI_PAGAMENTO.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="rm-label">DATA EMISSIONE</label>
            <input type="date" className="rm-input" value={e.dataEmissione} onChange={(ev) => set("dataEmissione", ev.target.value)} />
          </div>
          <div>
            <label className="rm-label">SCADENZA</label>
            <input type="date" className="rm-input" value={e.dataScadenza} onChange={(ev) => set("dataScadenza", ev.target.value)} />
          </div>
        </div>
      </div>

      <div className="border-t border-rm-border flex">
        <button onClick={onCancel} className="flex-1 py-3 text-xs text-rm-muted uppercase tracking-[0.12em] font-semibold border-r border-rm-border hover:text-white transition-colors">ANNULLA</button>
        <button onClick={() => onConfirm(e)} className="flex-[2] py-3 bg-rm-accent text-black text-xs font-black uppercase tracking-[0.1em] hover:bg-white transition-colors">SALVA FATTURA</button>
      </div>
    </div>
  );
}
