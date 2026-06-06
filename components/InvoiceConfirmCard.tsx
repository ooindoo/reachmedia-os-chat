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
    <div className="bg-zinc-800 border border-amber-700/50 rounded-2xl p-4 space-y-3 max-w-sm w-full">
      <p className="text-xs text-amber-400 uppercase tracking-widest font-semibold">📄 Conferma fattura</p>

      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Descrizione</label>
        <input className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-amber-500 outline-none"
          value={e.descrizione} onChange={(ev) => set("descrizione", ev.target.value)} />
      </div>

      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Cliente</label>
        <select className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-amber-500 outline-none"
          value={e.cliente} onChange={(ev) => set("cliente", ev.target.value)}>
          <option value="">— Nessun cliente —</option>
          {CLIENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Importo lordo €</label>
          <input type="number" min="0" step="0.01"
            className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-amber-500 outline-none"
            value={e.importoLordo} onChange={(ev) => set("importoLordo", parseFloat(ev.target.value) || 0)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Tipo documento</label>
          <select className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-amber-500 outline-none"
            value={e.tipoDocumento} onChange={(ev) => set("tipoDocumento", ev.target.value as InvoiceData["tipoDocumento"])}>
            {TIPI_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Mese</label>
          <select className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-amber-500 outline-none"
            value={e.mese} onChange={(ev) => set("mese", ev.target.value as InvoiceData["mese"])}>
            {MESI.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Anno</label>
          <select className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-amber-500 outline-none"
            value={e.anno} onChange={(ev) => set("anno", ev.target.value as InvoiceData["anno"])}>
            {ANNI.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Stato pagamento</label>
          <select className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-amber-500 outline-none"
            value={e.statoPagamento} onChange={(ev) => set("statoPagamento", ev.target.value as InvoiceData["statoPagamento"])}>
            {STATI_PAGAMENTO.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Metodo pagamento</label>
          <select className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-amber-500 outline-none"
            value={e.metodoPagamento} onChange={(ev) => set("metodoPagamento", ev.target.value as InvoiceData["metodoPagamento"])}>
            {METODI_PAGAMENTO.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Data emissione</label>
          <input type="date" className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-amber-500 outline-none"
            value={e.dataEmissione} onChange={(ev) => set("dataEmissione", ev.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Scadenza</label>
          <input type="date" className="w-full bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-amber-500 outline-none"
            value={e.dataScadenza} onChange={(ev) => set("dataScadenza", ev.target.value)} />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-sm text-zinc-400 border border-zinc-700 hover:border-zinc-500 transition-colors">Annulla</button>
        <button onClick={() => onConfirm(e)} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors">Salva Fattura</button>
      </div>
    </div>
  );
}
