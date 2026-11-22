import { minutesBetweenLocal, shiftDate } from "../tz";
import type { Categoria } from "./config";

const MAX_OVERRIDES = 5;           // Google limit
const MAX_MINUTES = 4 * 7 * 24 * 60; // Google limit: 4 weeks

/**
 * Popup reminder offsets (minutes before start) for an event.
 *   chiamata         → 15 min before, at start
 *   personale        → 1 day, 1 hour, 15 min before
 *   pratica          → evening before at 20:00, 1 hour, 10 min before
 *   scadenza_lavoro  → 2 days, 1 day, 1 hour before
 *   airbnb           → 1 day, 1 hour before
 */
export function reminderMinutes(categoria: Categoria, date: string, time: string): number[] {
  let mins: number[];
  switch (categoria) {
    case "chiamata":
      mins = [15, 0];
      break;
    case "personale":
      mins = [1440, 60, 15];
      break;
    case "pratica":
      mins = [minutesBetweenLocal(shiftDate(date, -1), "20:00", date, time), 60, 10];
      break;
    case "scadenza_lavoro":
      mins = [2880, 1440, 60];
      break;
    case "airbnb":
      mins = [1440, 60];
      break;
  }
  return Array.from(new Set(mins))
    .filter((m) => m >= 0 && m <= MAX_MINUTES)
    .slice(0, MAX_OVERRIDES);
}

export function reminderOverrides(categoria: Categoria, date: string, time: string) {
  return {
    useDefault: false,
    overrides: reminderMinutes(categoria, date, time).map((minutes) => ({ method: "popup" as const, minutes })),
  };
}
