/**
 * TanStack Start Server Functions for Arranged Make-up Classes
 * Synchronizes make-up lectures, room reservations, teacher bookings, and batch alerts across all devices.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MakeupClassRecord } from "./makeup-classes.ts";

export interface MakeupSyncResponse {
  records: MakeupClassRecord[];
  persistent: boolean;
}

export interface AddMakeupResponse {
  record: MakeupClassRecord;
  persistent: boolean;
  dbSaved: boolean;
}

const MakeupClassSchema = z.object({
  id: z.string().min(1),
  day: z.number().int().min(0).max(6),
  slot: z.number().int().min(0).max(10),
  batch: z.number().int().min(-1),
  room: z.number().int().min(-1),
  teacher: z.number().int().min(-1),
  subject: z.number().int().min(-1),
  note: z.string().optional(),
  targetDate: z.string().optional(),
  targetDateLabel: z.string().optional(),
  expiresAt: z.string().optional(),
  status: z.enum(["active", "completed", "cancelled"]).optional(),
  autoReleasedAt: z.string().optional(),
  createdAt: z.string(),
  createdByEmail: z.string(),
});

export const getActiveMakeupClassesServerFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<MakeupSyncResponse> => {
  const { serverGetActiveMakeupClasses } = await import("./makeup.server.ts");
  return await serverGetActiveMakeupClasses();
});

export const addMakeupClassServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => MakeupClassSchema.parse(d))
  .handler(async ({ data }): Promise<AddMakeupResponse> => {
    const { serverAddMakeupClass } = await import("./makeup.server.ts");
    return await serverAddMakeupClass(data as MakeupClassRecord);
  });

export const removeMakeupClassServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<boolean> => {
    const { serverRemoveMakeupClass } = await import("./makeup.server.ts");
    return await serverRemoveMakeupClass(data.id);
  });
