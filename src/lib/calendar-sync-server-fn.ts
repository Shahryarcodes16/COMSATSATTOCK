/**
 * TanStack Start Server Functions for FORTIS LiveSync
 * Client-callable RPC endpoints for generating and managing live WebCal subscriptions.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ClassEntrySchema = z.object({
  day: z.number(),
  slot: z.number(),
  batch: z.number(),
  room: z.number(),
  teacher: z.number(),
  subject: z.number(),
  repeater: z.boolean(),
  isMakeup: z.boolean().optional(),
  makeupId: z.string().optional(),
  makeupNote: z.string().optional(),
});

function buildCalendarUrls(origin: string, path: string) {
  const cleanOrigin = origin.replace(/\/$/, "");
  const httpsUrl = `${cleanOrigin}${path}`;
  // Replace https:// or http:// with webcal://
  const hostAndPath = cleanOrigin.replace(/^https?:\/\//, "") + path;
  const webcalUrl = `webcal://${hostAndPath}`;

  const googleCalendarUrl = `https://calendar.google.com/calendar/r/addbyurl?cid=${encodeURIComponent(httpsUrl)}`;
  const appleCalendarUrl = webcalUrl;
  const outlookCalendarUrl = `https://outlook.live.com/calendar/0/addcalendar?url=${encodeURIComponent(webcalUrl)}`;

  return {
    httpsUrl,
    webcalUrl,
    googleCalendarUrl,
    appleCalendarUrl,
    outlookCalendarUrl,
  };
}

export const createOrUpdateCalendarSyncServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().optional(),
      title: z.string().default("My Schedule"),
      entries: z.array(ClassEntrySchema),
      studentId: z.string().nullable().optional(),
      studentEmail: z.string().nullable().optional(),
      batchName: z.string().nullable().optional(),
      clientOrigin: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { saveCalendarSyncRecord } = await import("./calendar-sync.server.ts");
    const record = await saveCalendarSyncRecord({
      id: data.token,
      title: data.title,
      entries: data.entries,
      studentId: data.studentId,
      studentEmail: data.studentEmail,
      batchName: data.batchName,
    });

    const origin = data.clientOrigin || "https://fortis-cuiatk.edu.pk";
    const path = `/api/calendar/sync/${record.id}`;
    const urls = buildCalendarUrls(origin, path);

    return {
      success: true,
      token: record.id,
      title: record.title,
      accessCount: record.accessCount,
      lastAccessedAt: record.lastAccessedAt,
      entriesCount: record.entries.length,
      ...urls,
    };
  });

export const getCalendarSyncStatusServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(1),
      clientOrigin: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { getCalendarSyncRecord } = await import("./calendar-sync.server.ts");
    const record = await getCalendarSyncRecord(data.token);
    if (!record) {
      return { success: false, found: false };
    }

    const origin = data.clientOrigin || "https://fortis-cuiatk.edu.pk";
    const path = `/api/calendar/sync/${record.id}`;
    const urls = buildCalendarUrls(origin, path);

    return {
      success: true,
      found: true,
      token: record.id,
      title: record.title,
      accessCount: record.accessCount,
      lastAccessedAt: record.lastAccessedAt,
      entriesCount: record.entries.length,
      ...urls,
    };
  });

export const getBatchSectionSyncUrlsServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      batchName: z.string().min(1),
      clientOrigin: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { getEntriesForSection } = await import("./calendar-sync.server.ts");
    const { batchName, entries } = await getEntriesForSection(data.batchName);

    const origin = data.clientOrigin || "https://fortis-cuiatk.edu.pk";
    const cleanBatchSlug = encodeURIComponent(batchName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-"));
    const path = `/api/calendar/sync/section/${cleanBatchSlug}`;
    const urls = buildCalendarUrls(origin, path);

    return {
      success: true,
      batchName,
      entriesCount: entries.length,
      ...urls,
    };
  });
