"use client";

import { useState } from "react";
import { STATI_PAGAMENTO } from "@/lib/clients";
import type { InvoiceSearchResult, InvoiceUpdate } from "@/lib/invoice-update";

interface Props {
  invoice: InvoiceSearchResult;
  updates: InvoiceUpdate;
  onConfirm: (updates: InvoiceUpdate) => void;
  onCancel: () => void;
}

const fl = "shrink-0 w-[110px] text-[11px] text-[#555] uppercase tracking-[0.08em] font-semibold leading-[1.4]";
const fr = "flex items-start gap-3 px-4 py-3 border-b border-[#1a1a1a]";

export default function InvoiceUpdateCard({ invoice, updates, onConfirm, onCancel }: Props) {
  const [e, setE] = useState<InvoiceUpdate>({ ...updates });

  return (
    <div className="bg-[#111111] border border-[#222] w-full max-w-[520px]">

      <div className="px-4 py-3 border-b border-[#1a1a1a]">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white">AGGIORNA FATTURA</span>
      </div>

      {/* Invoice preview */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] bg-[#0d0d0d]">
        <p className="text-white text-sm font-bold uppercase truncate">{invoice.descrizione || "Fattura"}</p>
        <div className="flex gap-3 mt-0.5 flex-wrap">
          {invoice.cliente && (
            <span className="text-[#444] text-[10px] uppercase tracking-wide">{invoice.cliente}</span>
          )}
          {invoice.importo > 0 && (
            <span className="text-[#444] text-[10px]">€{invoice.importo}</span>
          )}
          {invoice.statoPagamento && (
            <span className="text-[#555] text-[10px] uppercase">{invoice.statoPagamento}</span>
          )}
        </div>
      </div>

      {/* STATO PAGAMENTO — badge buttons */}
      <div className={fr}>
        <span className={`${fl} pt-0.5`}>STATO</span>
        <div className="flex flex-wrap gap-1.5">
          {STATI_PAGAMENTO.map((s) => (
            <button
              key={s}
              onClick={() => setE({ statoPagamento: s })}
              className={`px-2.5 py-[3px] text-[11px] font-black uppercase bg-[#1a1a1a] border border-[#333] transition-colors ${
                e.statoPagamento === s
                  ? "text-[#CCFF00] border-[#CCFF00]"
                  : "text-[#555]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2">
        <button
          onClick={() => onConfirm(e)}
          disabled={!e.statoPagamento}
          className="w-full py-3 bg-[#CCFF00] text-black text-[11px] font-black uppercase tracking-[0.08em] hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          AGGIORNA
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
