/**
 * Timezone utilities for Europe/Rome (UTC+1 CET / UTC+2 CEST).
 * All date calculations that will be shown to the user or saved to external
 * services (Notion, Google Calendar) must use these helpers so the app
 * behaves correctly regardless of the server's own timezone (Vercel runs UTC).
 */

const ROME = "Europe/Rome";

// sv-SE locale formats dates as ISO YYYY-MM-DD — safe for all Node versions.
const romeDateFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: ROME });

/** Today's date as YYYY-MM-DD in Rome timezone. */
export function todayRome(): string {
  return romeDateFmt.format(new Date());
}

/** Current month index (0-based) in Rome timezone. */
export function currentMonthRome(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ROME, month: "numeric",
  }).formatToParts(new Date());
  return parseInt(parts.find((p) => p.type === "month")!.value) - 1;
}

/** Current full year in Rome timezone. */
export function currentYearRome(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ROME, year: "numeric",
  }).formatToParts(new Date());
  return parseInt(parts.find((p) => p.type === "year")!.value);
}

/**
 * Shift a YYYY-MM-DD string by `days` days.
 * Uses noon UTC to avoid DST edge-cases (Rome is never more than 2h from UTC).
 */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return romeDateFmt.format(d);
}

/**
 * Day-of-week index (0=Sun … 6=Sat) for a YYYY-MM-DD date in Rome timezone.
 */
function romeDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ROME, weekday: "short",
  }).formatToParts(d);
  const short = parts.find((p) => p.type === "weekday")!.value; // "Mon","Tue"…
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[short] ?? 0;
}

/**
 * Next occurrence of a named weekday (Italian) from `fromStr` (default: today Rome).
 * Returns YYYY-MM-DD in Rome timezone.
 */
export function nextWeekdayRome(dayName: string, fromStr?: string): string {
  const italianToIndex: Record<string, number> = {
    lunedì: 1, martedì: 2, mercoledì: 3, giovedì: 4,
    venerdì: 5, sabato: 6, domenica: 0,
  };
  const target = italianToIndex[dayName.toLowerCase()];
  if (target === undefined) return todayRome();

  const base = fromStr ?? todayRome();
  const currentDay = romeDayOfWeek(base);
  let diff = target - currentDay;
  if (diff <= 0) diff += 7;
  return shiftDate(base, diff);
}

/**
 * UTC offset string for Europe/Rome on a given YYYY-MM-DD date.
 * Returns "+02:00" during CEST (summer) or "+01:00" during CET (winter).
 */
export function romeOffset(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  // Get the hour in Rome and compare with UTC hour to derive offset.
  const utcH = d.getUTCHours(); // always 12
  const romeH = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ROME, hour: "numeric", hour12: false,
    }).format(d),
    10
  );
  const offsetH = ((romeH - utcH) + 24) % 24; // 1 or 2
  return `+0${offsetH}:00`;
}

/**
 * Build a full Notion datetime string: "YYYY-MM-DDTHH:MM:00.000±HH:MM"
 * using the correct Rome offset for the given date.
 */
export function notionDatetime(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00.000${romeOffset(dateStr)}`;
}
