/**
 * Google Calendar through Composio (@composio/core), account arditnwork@gmail.com.
 *
 * Claude never sees the raw Composio tools: these wrappers force the safe
 * parameters on every call:
 *  - only the 5 area calendars (never "primary")
 *  - exclude_organizer true, create_meeting_room false, no attendees
 *  - send_updates "none", no colorId
 *  - reminders applied with a PATCH right after creation (CREATE can't set them)
 *  - always the pinned connected account (never email.ma.agency@gmail.com)
 */
import { Composio } from "@composio/core";
import { addMinutesLocal, isoToRomeLocal, minutesBetweenLocal, rfc3339Rome } from "../tz";
import {
  AREAS, AREA_KEYS, GCAL_TOOLKIT_VERSION, MIN_DURATION_MINUTES,
  isArea, isCategoria, type Area, type Categoria,
} from "./config";
import { reminderOverrides } from "./reminders";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

let client: Composio | null = null;
function composio(): Composio {
  if (!client) {
    client = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
      ...(GCAL_TOOLKIT_VERSION ? { toolkitVersions: { googlecalendar: GCAL_TOOLKIT_VERSION } } : {}),
    });
  }
  return client;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return v;
}

async function exec(slug: string, args: AnyRecord): Promise<AnyRecord> {
  const res = await composio().tools.execute(slug, {
    userId: requireEnv("COMPOSIO_USER_ID"),
    connectedAccountId: requireEnv("COMPOSIO_GCAL_ACCOUNT_ID"),
    arguments: args,
    ...(GCAL_TOOLKIT_VERSION ? {} : { dangerouslySkipVersionCheck: true }),
  });
  if (!res.successful) throw new Error(`${slug}: ${res.error ?? "errore sconosciuto"}`);
  return res.data as AnyRecord;
}

/** Composio nests the Google event differently per tool: find the object with an id. */
function extractEvent(data: AnyRecord): AnyRecord {
  const candidates = [data?.response_data, data?.event, data?.data, data];
  for (const c of candidates) if (c && typeof c === "object" && typeof c.id === "string") return c;
  throw new Error("Risposta Composio senza ID evento");
}

function extractItems(data: AnyRecord): AnyRecord[] {
  const candidates = [
    data?.event_data?.event_data, data?.event_data?.items, data?.event_data,
    data?.items, data?.response_data?.items, data?.events,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** Saved on the event: drives "Le 3 cose" in the briefing. */
export type TipoEvento = "cosa_da_fare" | "appuntamento";

export interface NewEvent {
  area: Area;
  titolo: string;
  data: string;       // YYYY-MM-DD
  ora: string;        // HH:MM
  durataMinuti: number;
  categoria: Categoria;
  descrizione?: string;
  notionPageId?: string;
  tipo?: TipoEvento;
  /** Duration comes from an explicit end time ("dalle 11 alle 11:15"): keep it even under 30 min. */
  durataEsatta?: boolean;
}

export interface CreatedEvent {
  area: Area;
  calendarId: string;
  eventId: string;
  htmlLink?: string;
  titolo: string;
  data: string;
  ora: string;
  fineData: string;
  fineOra: string;
}

/** Compact event as returned to Claude and stored as a snapshot in the log. */
export interface FoundEvent {
  area: Area;
  calendarId: string;
  eventId: string;
  titolo: string;
  data: string;
  ora: string | null;   // null for all-day events
  fineData: string;
  fineOra: string | null;
  descrizione: string;
  categoria: Categoria | null;
  notionPageId: string | null;
  tipo: TipoEvento | null;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createEvent(e: NewEvent): Promise<CreatedEvent> {
  const { calendarId } = AREAS[e.area];
  const durata = e.durataEsatta && e.durataMinuti > 0
    ? Math.round(e.durataMinuti)
    : Math.max(MIN_DURATION_MINUTES, Math.round(e.durataMinuti || MIN_DURATION_MINUTES));
  const end = addMinutesLocal(e.data, e.ora, durata);

  const privateProps: Record<string, string> = { rmBot: "1", rmCategoria: e.categoria };
  if (e.notionPageId) privateProps.rmNotionPageId = e.notionPageId;
  if (e.tipo) privateProps.rmTipo = e.tipo;

  const created = extractEvent(
    await exec("GOOGLECALENDAR_CREATE_EVENT", {
      calendar_id: calendarId,
      summary: e.titolo,
      description: e.descrizione ?? "",
      start_datetime: `${e.data}T${e.ora}:00`,
      end_datetime: `${end.date}T${end.time}:00`,
      timezone: "Europe/Rome",
      exclude_organizer: true,
      create_meeting_room: false,
      attendees: [],
      send_updates: "none",
      extended_properties: { private: privateProps },
    })
  );

  const result: CreatedEvent = {
    area: e.area, calendarId, eventId: created.id, htmlLink: created.htmlLink,
    titolo: e.titolo, data: e.data, ora: e.ora, fineData: end.date, fineOra: end.time,
  };

  // CREATE can't set reminders: apply them now. If that fails twice, remove the
  // event so we never leave one without the promised reminders.
  const reminders = reminderOverrides(e.categoria, e.data, e.ora);
  for (let attempt = 1; ; attempt++) {
    try {
      await exec("GOOGLECALENDAR_PATCH_EVENT", {
        calendar_id: calendarId, event_id: created.id, reminders, send_updates: "none",
      });
      break;
    } catch (err) {
      if (attempt >= 2) {
        await deleteEvent(calendarId, created.id).catch(() => {});
        throw new Error(`Promemoria non applicati, evento rimosso: ${(err as Error).message}`);
      }
    }
  }
  return result;
}

// ── Search ────────────────────────────────────────────────────────────────────

function toFound(area: Area, ev: AnyRecord): FoundEvent | null {
  if (!ev?.id || ev.status === "cancelled") return null;
  const startIso: string | undefined = ev.start?.dateTime;
  const endIso: string | undefined = ev.end?.dateTime;
  const start = startIso ? isoToRomeLocal(startIso) : { date: ev.start?.date ?? "", time: null };
  const end = endIso ? isoToRomeLocal(endIso) : { date: ev.end?.date ?? "", time: null };
  const priv = ev.extendedProperties?.private ?? {};
  return {
    area,
    calendarId: AREAS[area].calendarId,
    eventId: ev.id,
    titolo: ev.summary ?? "(senza titolo)",
    data: start.date,
    ora: start.time,
    fineData: end.date,
    fineOra: end.time,
    descrizione: String(ev.description ?? "").slice(0, 500),
    categoria: isCategoria(priv.rmCategoria) ? priv.rmCategoria : null,
    notionPageId: typeof priv.rmNotionPageId === "string" ? priv.rmNotionPageId : null,
    tipo: priv.rmTipo === "cosa_da_fare" || priv.rmTipo === "appuntamento" ? priv.rmTipo : null,
  };
}

/** Search the area calendars (all 5 unless one is given), never "primary". */
export async function searchEvents(opts: {
  testo?: string | null; da: string; a: string; area?: Area | null;
}): Promise<FoundEvent[]> {
  const areas = opts.area && isArea(opts.area) ? [opts.area] : AREA_KEYS;
  const timeMin = rfc3339Rome(opts.da, "00:00");
  const timeMax = rfc3339Rome(opts.a, "23:59");
  const perArea = await Promise.all(
    areas.map(async (area) => {
      const args: AnyRecord = {
        calendar_id: AREAS[area].calendarId,
        time_min: timeMin,
        time_max: timeMax,
        single_events: true,
        order_by: "startTime",
        max_results: 25,
        event_types: ["default"],
      };
      if (opts.testo?.trim()) args.query = opts.testo.trim();
      const items = extractItems(await exec("GOOGLECALENDAR_FIND_EVENT", args));
      return items.map((ev) => toFound(area, ev)).filter((x): x is FoundEvent => x !== null);
    })
  );
  return perArea.flat().sort((x, y) => `${x.data}${x.ora ?? ""}`.localeCompare(`${y.data}${y.ora ?? ""}`));
}

// ── Update (same calendar only) ──────────────────────────────────────────────

export interface EventChanges {
  titolo?: string;
  data?: string;
  ora?: string;
  durataMinuti?: number;
  /** Explicit end time ("alle 11:15"): duration = end − start, kept even under 30 min. */
  oraFine?: string;
  categoria?: Categoria;
}

/** Computes the new start/end of an existing timed event after the changes. */
export function nextTiming(ev: FoundEvent, ch: EventChanges) {
  if (!ev.ora || !ev.fineOra) throw new Error("Gli eventi di tutto il giorno non si modificano dal bot");
  const data = ch.data ?? ev.data;
  const ora = ch.ora ?? ev.ora;
  const currentDuration = minutesBetweenLocal(ev.data, ev.ora, ev.fineData, ev.fineOra);
  let durata: number;
  if (ch.oraFine) {
    durata = minutesBetweenLocal(data, ora, data, ch.oraFine);
    if (durata <= 0) throw new Error("l'orario di fine deve essere dopo l'inizio");
  } else if (ch.durataMinuti !== undefined) {
    durata = Math.max(MIN_DURATION_MINUTES, Math.round(ch.durataMinuti));
  } else {
    durata = currentDuration; // moving an event keeps its length
  }
  const end = addMinutesLocal(data, ora, durata);
  return { data, ora, durata, durataEsatta: Boolean(ch.oraFine), fineData: end.date, fineOra: end.time };
}

/** PATCH in place. Never changes calendar_id: changing area is delete + recreate. */
export async function patchEvent(ev: FoundEvent, ch: EventChanges) {
  const t = nextTiming(ev, ch);
  const timingChanged = t.data !== ev.data || t.ora !== ev.ora || t.fineData !== ev.fineData || t.fineOra !== ev.fineOra;
  const categoria = ch.categoria ?? ev.categoria;

  const args: AnyRecord = { calendar_id: ev.calendarId, event_id: ev.eventId, send_updates: "none" };
  if (ch.titolo) args.summary = ch.titolo;
  if (timingChanged) {
    args.start_time = rfc3339Rome(t.data, t.ora);
    args.end_time = rfc3339Rome(t.fineData, t.fineOra);
    args.timezone = "Europe/Rome";
  }
  // Recompute reminders when the timing or category changes (the "evening
  // before at 20:00" reminder depends on the start time).
  if (categoria && (timingChanged || ch.categoria)) {
    args.reminders = reminderOverrides(categoria, t.data, t.ora);
  }
  if (ch.categoria) {
    args.extended_properties = {
      private: {
        rmBot: "1", rmCategoria: ch.categoria,
        ...(ev.notionPageId ? { rmNotionPageId: ev.notionPageId } : {}),
        ...(ev.tipo ? { rmTipo: ev.tipo } : {}),
      },
    };
  }
  await exec("GOOGLECALENDAR_PATCH_EVENT", args);
  return { ...t, titolo: ch.titolo ?? ev.titolo, timingChanged };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  if (!Object.values(AREAS).some((a) => a.calendarId === calendarId)) {
    throw new Error("Calendario non consentito");
  }
  await exec("GOOGLECALENDAR_DELETE_EVENT", { calendar_id: calendarId, event_id: eventId, send_updates: "none" });
}

// ── Read-only: all calendars (morning briefing) ──────────────────────────────

export interface CalendarInfo { id: string; nome: string; area: Area | null }

/** Every calendar visible in the account (primary, holidays, the 5 areas…). */
export async function listAllCalendars(): Promise<CalendarInfo[]> {
  const data = await exec("GOOGLECALENDAR_LIST_CALENDARS", {});
  const items: AnyRecord[] = data?.calendars ?? data?.items ?? [];
  return items
    .filter((c) => c.selected !== false && !c.deleted)
    .map((c) => {
      const area = AREA_KEYS.find((k) => AREAS[k].calendarId === c.id);
      const nome = area ? AREAS[area].label : c.primary ? "Principale" : String(c.summaryOverride ?? c.summary ?? c.id);
      return { id: String(c.id), nome, area: area ?? null };
    })
    // Area calendars first: when an event is in two calendars, the area one wins.
    .sort((a, b) => Number(Boolean(b.area)) - Number(Boolean(a.area)));
}

export interface DayEvent {
  key: string;          // iCalUID (dedup across calendars)
  titolo: string;
  ora: string | null;   // null = all-day
  calendario: string;
  area: Area | null;
  categoria: Categoria | null;
  tipo: TipoEvento | null;
  notionPageId: string | null;
}

/** Events of one calendar overlapping the given Rome day, excluding cancelled and declined ones. */
export async function listEventsOn(cal: CalendarInfo, date: string): Promise<DayEvent[]> {
  const nextDay = addMinutesLocal(date, "00:00", 24 * 60).date;
  const items = extractItems(
    await exec("GOOGLECALENDAR_FIND_EVENT", {
      calendar_id: cal.id,
      time_min: rfc3339Rome(date, "00:00"),
      time_max: rfc3339Rome(nextDay, "00:00"),
      single_events: true,
      order_by: "startTime",
      max_results: 50,
    })
  );
  return items
    .filter((ev) => ev?.status !== "cancelled")
    .filter((ev) => !(ev.attendees ?? []).some((a: AnyRecord) => a.self && a.responseStatus === "declined"))
    .map((ev) => {
      const start = ev.start?.dateTime ? isoToRomeLocal(ev.start.dateTime) : null;
      // A timed event that started on a previous day counts as all-day for today.
      const ora = start && start.date === date ? start.time : null;
      const priv = ev.extendedProperties?.private ?? {};
      return {
        key: String(ev.iCalUID ?? ev.id),
        titolo: ev.summary ?? "(senza titolo)",
        ora,
        calendario: cal.nome,
        area: cal.area,
        categoria: isCategoria(priv.rmCategoria) ? priv.rmCategoria : null,
        tipo: priv.rmTipo === "cosa_da_fare" || priv.rmTipo === "appuntamento" ? priv.rmTipo : null,
        notionPageId: typeof priv.rmNotionPageId === "string" ? priv.rmNotionPageId : null,
      };
    });
}
