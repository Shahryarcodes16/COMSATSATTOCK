/**
 * TanStack Start Server Functions for Real-Time Class Cancellations
 * Automatically distributes cancellation notices to student devices
 * and coordinates room status across the campus.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ClassCancellationRecord } from "./timetable-types.ts";

export interface CancellationsSyncResponse {
  records: ClassCancellationRecord[];
  persistent: boolean;
}

export interface AddCancellationResponse {
  record: ClassCancellationRecord;
  persistent: boolean;
  dbSaved: boolean;
}

export const getAllActiveCancellationsServerFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<CancellationsSyncResponse> => {
  const { serverGetCancellationsWithStatus } = await import("./cancellations.server.ts");
  return await serverGetCancellationsWithStatus();
});

const AddCancellationSchema = z.object({
  id: z.string().min(1),
  day: z.number().int().min(0).max(6),
  slot: z.number().int().min(0).max(10),
  batch: z.number().int().min(-1),
  batchName: z.string(),
  room: z.number().int().min(-1),
  roomName: z.string(),
  teacher: z.number().int().min(-1),
  teacherName: z.string(),
  subject: z.number().int().min(-1),
  subjectName: z.string(),
  targetDate: z.string(),
  targetDateLabel: z.string(),
  reason: z.string(),
  cancelledAt: z.string(),
  cancelledByEmail: z.string(),
  status: z.enum(["active", "settled"]),
  settledByMakeupId: z.string().optional(),
});

export const addClassCancellationServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => AddCancellationSchema.parse(d))
  .handler(async ({ data }): Promise<AddCancellationResponse> => {
    const { serverAddClassCancellationWithStatus } = await import("./cancellations.server.ts");
    return await serverAddClassCancellationWithStatus(data as ClassCancellationRecord);
  });

export const removeClassCancellationServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<boolean> => {
    const { serverRemoveClassCancellation } = await import("./cancellations.server.ts");
    return await serverRemoveClassCancellation(data.id);
  });

export const settleClassCancellationServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) =>
    z.object({ cancellationId: z.string().min(1), makeupId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }): Promise<boolean> => {
    const { serverSettleClassCancellation } = await import("./cancellations.server.ts");
    return await serverSettleClassCancellation(data.cancellationId, data.makeupId);
  });
