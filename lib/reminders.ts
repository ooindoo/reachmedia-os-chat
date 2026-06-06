// ── Types ──────────────────────────────────────────────────────────────────────
export interface Reminder {
  id: string;
  taskTitle: string;
  cliente: string;
  reminderAt: string; // ISO datetime e.g. "2026-06-10T14:00:00"
  notionUrl: string;
  notified: boolean;
  createdAt: number;
}

const STORAGE_KEY = "rm-task-reminders";

// ── Storage helpers ────────────────────────────────────────────────────────────
export function getReminders(): Reminder[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveReminder(data: Omit<Reminder, "id" | "notified" | "createdAt">): string {
  const id = crypto.randomUUID();
  const reminders = getReminders();
  reminders.push({ ...data, id, notified: false, createdAt: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  return id;
}

export function markNotified(id: string) {
  const updated = getReminders().map((r) =>
    r.id === id ? { ...r, notified: true } : r
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function cleanOldReminders() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // keep 7 days
  const fresh = getReminders().filter((r) => r.createdAt > cutoff);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
}

// ── Schedule via Notification Triggers API (Chrome/Android) ───────────────────
async function tryTriggerAPI(
  title: string,
  body: string,
  at: Date
): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const NotificationAny = Notification as any;
    if (!NotificationAny.prototype || !("showTrigger" in NotificationAny.prototype)) {
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (reg as any).showNotification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      showTrigger: new (window as any).TimestampTrigger(at.getTime()),
    });
    return true;
  } catch {
    return false;
  }
}

// ── Schedule a reminder (tries Trigger API, falls back to setTimeout) ─────────
export async function scheduleReminder(
  reminder: Reminder,
  onFire: (r: Reminder) => void
) {
  if (Notification.permission !== "granted") return;

  const at = new Date(reminder.reminderAt);
  const delay = at.getTime() - Date.now();

  const title = "📋 Reminder task";
  const body = `${reminder.taskTitle}${reminder.cliente ? " · " + reminder.cliente : ""}`;

  if (delay <= 0) {
    // Already past — notify immediately if within 1h
    if (delay > -60 * 60 * 1000) onFire(reminder);
    return;
  }

  // Try Notification Triggers API first (works when browser/app is closed on Android)
  const triggered = await tryTriggerAPI(title, body, at);
  if (triggered) {
    markNotified(reminder.id); // trigger API handles delivery
    return;
  }

  // Fallback: setTimeout (works only while app is open)
  if (delay <= 48 * 60 * 60 * 1000) {
    setTimeout(() => onFire(reminder), delay);
  }
}

// ── On app load: reschedule all pending reminders ─────────────────────────────
export async function bootstrapReminders(onFire: (r: Reminder) => void) {
  cleanOldReminders();
  const pending = getReminders().filter((r) => !r.notified);
  for (const r of pending) {
    await scheduleReminder(r, onFire);
  }
}
