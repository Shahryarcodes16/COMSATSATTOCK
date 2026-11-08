/**
 * TanStack Start Server Functions for Timetable Management
 * Strict RPC validation with Zod and authenticated admin checks.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  TimetableRaw,
  TimetableVersion,
  TimetableDraft,
  TimetableSummary,
  TimetableDiffSummary,
} from "./timetable-types";

const TimetableRawSchema = z.object({
  b: z.array(z.string()),
  r: z.array(z.string()),
  t: z.array(z.string()),
  s: z.array(z.string()),
  e: z.array(z.array(z.number())),
});

/**
 * Public: Fetch currently active published timetable
 */
export const getActiveTimetableServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    versionName: string;
    timetableData: TimetableRaw;
    publishedAt: string;
    summary?: TimetableSummary;
  }> => {
    const { getActiveTimetableServer } = await import("./timetable-admin.server.ts");
    return getActiveTimetableServer();
  },
);

/**
 * Admin: Get all published timetable versions
 */
export const getAllTimetableVersionsServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<TimetableVersion[]> => {
    const { getAllTimetableVersionsServer } = await import("./timetable-admin.server.ts");
    return getAllTimetableVersionsServer();
  },
);

/**
 * Admin: Publish a new timetable version
 */
export const publishTimetableVersionServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      versionName: z.string().min(2, "Version name must be at least 2 characters"),
      timetableData: TimetableRawSchema,
      scheduledFor: z.string().nullable().optional(),
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean;
      error?: string;
      version?: TimetableVersion;
      diff?: TimetableDiffSummary;
    }> => {
      const { publishTimetableVersionServer } = await import("./timetable-admin.server.ts");
      return publishTimetableVersionServer({
        versionName: data.versionName,
        timetableData: data.timetableData as TimetableRaw,
        scheduledFor: data.scheduledFor,
      });
    },
  );

/**
 * Admin: Rollback to an earlier timetable version
 */
export const rollbackTimetableVersionServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      versionId: z.string().min(1, "Version ID is required"),
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean;
      error?: string;
      version?: TimetableVersion;
    }> => {
      const { rollbackTimetableVersionServer } = await import("./timetable-admin.server.ts");
      return rollbackTimetableVersionServer(data.versionId);
    },
  );

/**
 * Admin: Save a timetable draft
 */
export const saveTimetableDraftServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, "Draft name is required"),
      timetableData: TimetableRawSchema,
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean;
      error?: string;
      draft?: TimetableDraft;
    }> => {
      const { saveTimetableDraftServer } = await import("./timetable-admin.server.ts");
      return saveTimetableDraftServer({
        id: data.id,
        name: data.name,
        timetableData: data.timetableData as TimetableRaw,
      });
    },
  );

/**
 * Admin: List all drafts
 */
export const getAllTimetableDraftsServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<TimetableDraft[]> => {
    const { getAllTimetableDraftsServer } = await import("./timetable-admin.server.ts");
    return getAllTimetableDraftsServer();
  },
);

/**
 * Admin: Delete a draft
 */
export const deleteTimetableDraftServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1, "Draft ID is required"),
    }),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const { deleteTimetableDraftServer } = await import("./timetable-admin.server.ts");
    return deleteTimetableDraftServer(data.id);
  });
