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

// ── Guards ─────────────────────────────────────────────────────────────────────
/** true only when Notification API exists AND permission is granted */
function notifGranted(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

/** Safe UUID — falls back to Math.random on older iOS/browsers */
function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Storage helpers ────────────────────────────────────────────────────────────
export function getReminders(): Reminder[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setReminders(reminders: Reminder[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders)); } catch { /* noop */ }
}

export function saveReminder(data: Omit<Reminder, "id" | "notified" | "createdAt">): string {
  const id = randomId();
  const reminders = getReminders();
  reminders.push({ ...data, id, notified: false, createdAt: Date.now() });
  setReminders(reminders);
  return id;
}

export function markNotified(id: string) {
  setReminders(getReminders().map((r) => (r.id === id ? { ...r, notified: true } : r)));
}

export function cleanOldReminders() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  setReminders(getReminders().filter((r) => r.createdAt > cutoff));
}

// ── Try Notification Triggers API (Chrome Android only) ───────────────────────
async function tryTriggerAPI(
  title: string,
  body: string,
  at: Date,
  notionUrl: string
): Promise<boolean> {
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
      data: { notionUrl },
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
  if (!notifGranted()) return;
  markNotified(reminder.id);
  const body = `${reminder.taskTitle}${reminder.cliente ? " · " + reminder.cliente : ""}\nClicca per aprire su Notion`;
  try {
    const notif = new Notification("📋 Reminder task", {
      body,
      icon: "/favicon.ico",
      tag: reminder.id,
    });
    notif.onclick = () => {
      notif.close();
      if (reminder.notionUrl) window.open(reminder.notionUrl, "_blank");
      window.focus();
    };
  } catch {
    // Safari or permission blocked
  }
}

// ── Schedule a single reminder ─────────────────────────────────────────────────
export async function scheduleReminder(reminder: Reminder) {
  if (!notifGranted()) return;

  const at = new Date(reminder.reminderAt);
  const delay = at.getTime() - Date.now();
  const title = "📋 Reminder task";
  const body = `${reminder.taskTitle}${reminder.cliente ? " · " + reminder.cliente : ""}`;

  if (delay <= 0) {
    if (delay > -60 * 60 * 1000) fireReminder(reminder);
    return;
  }

  const triggered = await tryTriggerAPI(title, body, at, reminder.notionUrl);
  if (triggered) { markNotified(reminder.id); return; }

  if (delay <= 48 * 60 * 60 * 1000) {
    setTimeout(() => fireReminder(reminder), delay);
  }
}

// ── Poll check ────────────────────────────────────────────────────────────────
export function checkDueReminders() {
  if (!notifGranted()) return;
  const now = Date.now();
  for (const r of getReminders().filter((r) => !r.notified)) {
    const overdue = now - new Date(r.reminderAt).getTime();
    if (overdue >= 0 && overdue < 5 * 60 * 1000) fireReminder(r);
  }
}

// ── Bootstrap on app load ─────────────────────────────────────────────────────
export async function bootstrapReminders() {
  cleanOldReminders();
  for (const r of getReminders().filter((r) => !r.notified)) {
    await scheduleReminder(r);
  }
  checkDueReminders();
}
