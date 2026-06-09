import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { shiftDate } from "@/lib/tz";
import type { TaskData } from "@/lib/notion";

// Days to subtract from the deadline to get the event date.
// The event itself is the reminder — created at 09:00 on the offset day.
function reminderDayOffset(option: string): number | null {
  switch (option) {
    case "same_day": return 0;   // event on deadline day at 09:00
    case "1_day":    return -1;  // event 1 day before deadline at 09:00
    case "2_days":   return -2;  // event 2 days before deadline at 09:00
    case "1_week":   return -7;  // event 7 days before deadline at 09:00
    default:         return null;
  }
}


export async function POST(req: NextRequest) {
  // Get session server-side — access token never leaves the server
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Non autenticato con Google" }, { status: 401 });
  }
  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Token Google scaduto — rifai il login" }, { status: 401 });
  }

  const body = await req.json() as { task: TaskData; gcalReminder: string };
  const { task, gcalReminder } = body;

  if (!task.deadline) {
    return NextResponse.json({ error: "Deadline mancante" }, { status: 400 });
  }

  const offset = reminderDayOffset(gcalReminder);
  if (offset === null) {
    return NextResponse.json({ error: "Opzione reminder non valida" }, { status: 400 });
  }

  // The event date is the deadline shifted by the offset (e.g. -1 = day before).
  // Event runs 09:00–10:00 on that day and fires a popup at event start.
  const eventDate = shiftDate(task.deadline, offset);

  const event = {
    summary: `⚑ ${task.titolo}`,
    description: `Cliente: ${task.cliente || "—"} | Tipo: ${task.tipoAttivita || "—"} | Deadline: ${task.deadline} | reachmedia OS`,
    start: {
      dateTime: `${eventDate}T09:00:00`,
      timeZone: "Europe/Rome",
    },
    end: {
      dateTime: `${eventDate}T10:00:00`,
      timeZone: "Europe/Rome",
    },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 0 }], // popup fires at 09:00 on event day
    },
  };

  const gcRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!gcRes.ok) {
    const err = await gcRes.json().catch(() => ({})) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    const reason = err.error?.errors?.[0]?.reason ?? "";
    const msg = err.error?.message ?? "Errore Google Calendar";

    // Scope not granted — tell the client to re-authenticate
    const isScopeError =
      gcRes.status === 403 &&
      (reason === "insufficientPermissions" ||
        msg.toLowerCase().includes("insufficient") ||
        msg.toLowerCase().includes("scope"));

    if (isScopeError) {
      return NextResponse.json({ error: "SCOPE_ERROR", detail: msg }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const created = await gcRes.json() as { id: string; htmlLink: string };
  return NextResponse.json({ success: true, eventId: created.id, eventUrl: created.htmlLink });
}
