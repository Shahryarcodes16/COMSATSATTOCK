/**
 * Nitro Server Middleware for FORTIS LiveSync (Production & Preview)
 * Routes incoming /api/calendar/sync/* requests directly to the iCalendar generator.
 */
interface CalendarSyncEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

export default async function calendarSyncMiddleware(
  event: CalendarSyncEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return next();

  const path = event.url.pathname;
  if (!path.startsWith("/api/calendar/sync")) {
    return next();
  }

  try {
    const host =
      event.req.headers.get("x-forwarded-host") ??
      event.req.headers.get("host") ??
      event.url.host;
    const proto = event.req.headers.get("x-forwarded-proto") ?? "https";
    const fullUrl = `${proto}://${host}${path}${event.url.search}`;

    const request = new Request(fullUrl, {
      method,
      headers: event.req.headers,
    });

    const { handleCalendarSyncRequest } = await import("../../src/lib/calendar-sync.server.ts");
    return await handleCalendarSyncRequest(request);
  } catch (err) {
    console.error("[calendarSyncMiddleware] Error handling calendar sync request:", err);
    return new Response("Internal Server Error generating calendar feed", { status: 500 });
  }
}
