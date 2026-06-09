"use client";

import type { InvoiceSearchResult, InvoiceUpdate } from "@/lib/invoice-update";

interface Props {
  invoices: InvoiceSearchResult[];
  updates: InvoiceUpdate;
  onSelect: (invoice: InvoiceSearchResult) => void;
  onCancel: () => void;
}

export default function InvoiceSelectCard({ invoices, updates, onSelect, onCancel }: Props) {
  const summary = Object.entries(updates)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([, v]) => String(v))
    .join(", ");

  return (
    <div className="bg-[#111111] border border-[#222] w-full max-w-[520px]">

      <div className="px-4 py-3 border-b border-[#1a1a1a]">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white">QUALE FATTURA?</span>
      </div>

      <div className="divide-y divide-[#1a1a1a]">
        {invoices.map((inv) => (
          <button
            key={inv.id}
            onClick={() => onSelect(inv)}
            className="w-full text-left px-4 py-3 hover:bg-[#1a1a1a] transition-colors group"
          >
            <p className="text-white text-sm font-semibold group-hover:text-rm-accent transition-colors truncate">
              {inv.descrizione}
            </p>
            <div className="flex gap-3 mt-1 flex-wrap">
              {inv.cliente && (
                <span className="text-[10px] text-[#555] uppercase tracking-wide">{inv.cliente}</span>
              )}
              {inv.importo > 0 && (
                <span className="text-[10px] text-[#444]">€{inv.importo}</span>
              )}
              {inv.statoPagamento && (
                <span className="text-[10px] text-[#444] uppercase">{inv.statoPagamento}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {summary && (
        <div className="border-t border-[#1a1a1a] px-4 py-2">
          <p className="text-[10px] text-[#444] uppercase tracking-wide">Applicherà: {summary}</p>
        </div>
      )}

      <div className="p-4 border-t border-[#1a1a1a]">
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
