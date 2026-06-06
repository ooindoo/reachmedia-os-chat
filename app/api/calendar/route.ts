import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { TaskData } from "@/lib/notion";

// Minutes before the event start (09:00 on deadline day) that the popup fires
function reminderMinutes(option: string): number | null {
  switch (option) {
    case "same_day": return 0;              // fires at 09:00 on event day
    case "1_day":    return 24 * 60;        // fires at 09:00 one day before
    case "2_days":   return 2 * 24 * 60;    // fires at 09:00 two days before
    case "1_week":   return 7 * 24 * 60;    // fires at 09:00 one week before
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

  const mins = reminderMinutes(gcalReminder);

  // Build a timed event at 09:00 on the deadline day (Europe/Rome)
  const event = {
    summary: task.titolo,
    description: `Cliente: ${task.cliente || "—"} | Tipo: ${task.tipoAttivita || "—"} | reachmedia OS`,
    start: {
      dateTime: `${task.deadline}T09:00:00`,
      timeZone: "Europe/Rome",
    },
    end: {
      dateTime: `${task.deadline}T10:00:00`,
      timeZone: "Europe/Rome",
    },
    reminders: {
      useDefault: false,
      overrides: mins !== null ? [{ method: "popup", minutes: mins }] : [],
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
