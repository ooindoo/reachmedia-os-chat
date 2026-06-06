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
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const fresh = getReminders().filter((r) => r.createdAt > cutoff);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
}

// ── Try Notification Triggers API (Chrome Android only) ───────────────────────
async function tryTriggerAPI(title: string, body: string, at: Date): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).TimestampTrigger === "undefined") return false;
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

// ── Fire notification now ─────────────────────────────────────────────────────
export function fireReminder(reminder: Reminder) {
  if (Notification.permission !== "granted") return;
  markNotified(reminder.id);
  const body = `${reminder.taskTitle}${reminder.cliente ? " · " + reminder.cliente : ""}`;
  try {
    new Notification("📋 Reminder task", {
      body,
      icon: "/favicon.ico",
      tag: reminder.id, // prevents duplicate notifications
    });
  } catch {
    // Safari or blocked
  }
}

// ── Schedule a single reminder ─────────────────────────────────────────────────
export async function scheduleReminder(reminder: Reminder) {
  if (Notification.permission !== "granted") return;

  const at = new Date(reminder.reminderAt);
  const delay = at.getTime() - Date.now();

  const title = "📋 Reminder task";
  const body = `${reminder.taskTitle}${reminder.cliente ? " · " + reminder.cliente : ""}`;

  if (delay <= 0) {
    // Past but within 1h → fire immediately
    if (delay > -60 * 60 * 1000) fireReminder(reminder);
    return;
  }

  // Try Notification Triggers API (Chrome Android — works when app is closed)
  const triggered = await tryTriggerAPI(title, body, at);
  if (triggered) {
    markNotified(reminder.id);
    return;
  }

  // Fallback: precise setTimeout (works while tab is open)
  if (delay <= 48 * 60 * 60 * 1000) {
    setTimeout(() => fireReminder(reminder), delay);
  }
}

// ── Poll check — call this on interval & visibilitychange ─────────────────────
// This is the Mac/Desktop fallback: checks every ~60s and fires overdue reminders
export function checkDueReminders() {
  if (Notification.permission !== "granted") return;
  const now = Date.now();
  const pending = getReminders().filter((r) => !r.notified);

  for (const r of pending) {
    const reminderTime = new Date(r.reminderAt).getTime();
    const overdue = now - reminderTime;
    // Fire if within a ±5 minute window (overdue but not too old)
    if (overdue >= 0 && overdue < 5 * 60 * 1000) {
      fireReminder(r);
    }
  }
}

// ── Bootstrap on app load ─────────────────────────────────────────────────────
export async function bootstrapReminders() {
  cleanOldReminders();
  const pending = getReminders().filter((r) => !r.notified);
  for (const r of pending) {
    await scheduleReminder(r);
  }
  // Check immediately for any overdue reminders
  checkDueReminders();
}
