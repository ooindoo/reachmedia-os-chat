import type { TipoAttivita } from "../clients";

// ── Calendars (account arditnwork@gmail.com) ──────────────────────────────────
// The area decides the calendar. The colour comes from the calendar itself:
// never set colorId on events, never use "primary", never move events between
// calendars (moving drops reminders and leaves a duplicate invite).
export const AREAS = {
  chiamate_lavoro: {
    label: "Chiamate lavoro",
    calendarId: "b4eff740643d861136fb96248a919b586d349df26b6a13ce9f2b2d19bddcf1e4@group.calendar.google.com",
  },
  lavoro_clienti: {
    label: "Lavoro clienti",
    calendarId: "5d49ab8106da26e055fb6136e37204f576460faa886bba33e2c7b71376c31a90@group.calendar.google.com",
  },
  burocrazia_soldi: {
    label: "Burocrazia e soldi",
    calendarId: "5cbd34592d32928fad87aa542d3f1d7c59505d61df7f5ea1aa26c6fe53534126@group.calendar.google.com",
  },
  airbnb: {
    label: "Airbnb",
    calendarId: "5e4533501139a57d4de11be86a61295691bab3688b1c509a6dbc49b846b7fb44@group.calendar.google.com",
  },
  personale: {
    label: "Personale",
    calendarId: "f0cfc05ac5f1cb212d046601384f275d524bc48b33f745392805ac0d8d950183@group.calendar.google.com",
  },
} as const;

export type Area = keyof typeof AREAS;
export const AREA_KEYS = Object.keys(AREAS) as Area[];

export function isArea(v: unknown): v is Area {
  return typeof v === "string" && v in AREAS;
}

// ── Reminder categories (minutes are computed in reminders.ts) ────────────────
export const CATEGORIE = ["chiamata", "personale", "pratica", "scadenza_lavoro", "airbnb"] as const;
export type Categoria = (typeof CATEGORIE)[number];

export function isCategoria(v: unknown): v is Categoria {
  return typeof v === "string" && (CATEGORIE as readonly string[]).includes(v);
}

// ── Notion ────────────────────────────────────────────────────────────────────
/** Clienti data source (read-only, only Stato = "Attivo"). */
export const CLIENTI_DATA_SOURCE_ID = "78b2a353-104d-48cb-b569-f535a0b2134e";

/** Deliverable work types: the only ones that create a Notion task. */
export const TIPI_TASK_NOTION = [
  "📧 Newsletter",
  "🔄 Flow / Automation",
  "🛍 Shopify Dev",
  "📊 Report / Analytics",
  "✍️ Copy / Content",
  "🔧 Setup / Configurazione",
  "🐛 Fix / Bug",
  "📱 Social / Meta",
] as const satisfies readonly TipoAttivita[];
export type TipoTaskNotion = (typeof TIPI_TASK_NOTION)[number];

export function isTipoTaskNotion(v: unknown): v is TipoTaskNotion {
  return typeof v === "string" && (TIPI_TASK_NOTION as readonly string[]).includes(v);
}

// ── Misc ──────────────────────────────────────────────────────────────────────
export const MIN_DURATION_MINUTES = 30;
export const BOT_MODEL = "claude-sonnet-5-5";

/**
 * Composio Google Calendar toolkit version, pinned so a new toolkit release
 * can't silently change tool behaviour. Set COMPOSIO_GCAL_TOOLKIT_VERSION
 * (from scripts/composio-check.ts). When unset, execution falls back to the
 * latest version.
 */
export const GCAL_TOOLKIT_VERSION = process.env.COMPOSIO_GCAL_TOOLKIT_VERSION || null;
