// IDs verified directly from the Clienti database via API query
export const CLIENTS: Record<string, { id: string; name: string }> = {
  "Squale SA":             { id: "3776285ec206818fb9a4e609acbab5da", name: "Squale SA" },
  CappellettoShop:         { id: "3776285ec20681c38b88edd95edfc507", name: "CappellettoShop" },
  Luxyt:                   { id: "3776285ec206812e8ad5f11765f9f61f", name: "Luxyt" },
  NOESI:                   { id: "3776285ec206819c8ae7f482c9b30890", name: "NOESI" },
  Opplant:                 { id: "3776285ec20681e5ad16faba1dcefd73", name: "Opplant" },
  Markershop:              { id: "3776285ec20681109437eedaa97b8908", name: "Markershop" },
  "Shirò Pagani Boutique": { id: "3776285ec20681779a0df45152a99c85", name: "Shirò Pagani Boutique" },
  Sicura:                  { id: "3776285ec206811b9162fbd44e644372", name: "Sicura" },
  "Stewart Dawson":        { id: "3776285ec20681fe9105c359f47889f6", name: "Stewart Dawson" },
  "Giuseppe Toniolo Airbnb": { id: "3776285ec20681a7ade2f3adc44ff5ee", name: "Giuseppe Toniolo Airbnb" },
};
export const CLIENT_NAMES = Object.keys(CLIENTS);

// ── Task ──────────────────────────────────────────────────────────────────────
export const TIPI_ATTIVITA = [
  "📧 Newsletter", "🔄 Flow / Automation", "🛍 Shopify Dev",
  "📞 Call / Meeting", "📊 Report / Analytics", "✍️ Copy / Content",
  "🔧 Setup / Configurazione", "🐛 Fix / Bug", "📱 Social / Meta",
  "📬 Airbnb Messaggistica",
] as const;
export type TipoAttivita = (typeof TIPI_ATTIVITA)[number];

export const PRIORITA = ["🔴 Urgente", "🟡 Media", "🟢 Bassa"] as const;
export type Priorita = (typeof PRIORITA)[number];

// Canale (exact values from Notion DB)
export const CANALE_OPTS = [
  "📞 Telefono / WhatsApp",
  "📨 Klaviyo",
  "🛒 Shopify",
  "📘 Meta Ads",
  "🔍 Google Ads",
  "🏠 Airbnb",
  "📧 Email diretta",
  "🌐 Sito web",
] as const;
export type Canale = (typeof CANALE_OPTS)[number];

export const STATI_TASK = ["Not started", "In progress", "Done"] as const;
export type StatoTask = (typeof STATI_TASK)[number];

export const BLOCCATO_DA_OPTS = [
  "⏳ Attendo cliente", "🔗 Dipende da altra task",
  "🔑 Accessi mancanti", "➖ Non bloccato",
] as const;
export type BloccatoDa = (typeof BLOCCATO_DA_OPTS)[number];

export const APPROVAZIONE_OPTS = [
  "⏳ In attesa", "✅ Approvato",
  "❌ Modifiche richieste", "➖ Non necessaria",
] as const;
export type ApprovazioneCliente = (typeof APPROVAZIONE_OPTS)[number];

// ── Fatture ───────────────────────────────────────────────────────────────────
export const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
] as const;
export type Mese = (typeof MESI)[number];

export const ANNI = ["2024", "2025", "2026", "2027"] as const;
export type Anno = (typeof ANNI)[number];

export const STATI_PAGAMENTO = ["Da emettere", "Emessa", "Pagata", "In ritardo"] as const;
export type StatoPagamento = (typeof STATI_PAGAMENTO)[number];

// Exact values from Notion DB (with emoji)
export const METODI_PAGAMENTO = ["🏦 Bonifico", "💳 Carta", "💰 Contanti", "🔄 PayPal"] as const;
export type MetodoPagamento = (typeof METODI_PAGAMENTO)[number];

export const TIPI_DOCUMENTO = ["📄 Fattura", "🧾 Ricevuta", "📋 Proforma"] as const;
export type TipoDocumento = (typeof TIPI_DOCUMENTO)[number];

// ── Time Log ──────────────────────────────────────────────────────────────────
export const TIPI_SESSIONE = [
  "💻 Sviluppo", "✍️ Copy / Content", "📊 Analisi / Report",
  "📞 Call / Meeting", "🔧 Setup / Config", "📧 Email / Comunicazione",
  "🐛 Fix / Bug", "📋 Pianificazione",
] as const;
export type TipoSessione = (typeof TIPI_SESSIONE)[number];

export const ENERGIE = ["⚡ Alta", "😐 Media", "😴 Bassa"] as const;
export type Energia = (typeof ENERGIE)[number];

export const FATTURABILE_OPTS = ["✅ Sì", "❌ No"] as const;
export type Fatturabile = (typeof FATTURABILE_OPTS)[number];
