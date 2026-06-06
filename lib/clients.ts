export const CLIENTS: Record<string, { id: string; name: string }> = {
  "Squale SA": { id: "3776285ec2068107a081e2158cfbe199", name: "Squale SA" },
  CappellettoShop: { id: "3776285ec2068153ae00f1dc2885fee0", name: "CappellettoShop" },
  Luxyt: { id: "3776285ec2068120bc01e1f6adad5c96", name: "Luxyt" },
  NOESI: { id: "3776285ec20681cb9f36ce19ef90a21d", name: "NOESI" },
  Opplant: { id: "3776285ec20681019c9ac2406b5564cb", name: "Opplant" },
  Markershop: { id: "3776285ec206816c867cca789001887f", name: "Markershop" },
  "Shirò Pagani Boutique": { id: "3776285ec20681aabaa0e7122a339b06", name: "Shirò Pagani Boutique" },
  Sicura: { id: "3776285ec2068100a82ac929b31aee2b", name: "Sicura" },
  "Stewart Dawson": { id: "3776285ec20681809ebfe1071b278795", name: "Stewart Dawson" },
  "Giuseppe Toniolo Airbnb": { id: "3776285ec20681e3bb7fda9dc29532d2", name: "Giuseppe Toniolo Airbnb" },
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
