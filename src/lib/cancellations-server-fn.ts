/**
 * TanStack Start Server Functions for Real-Time Class Cancellations
 * Automatically distributes cancellation notices to student devices
 * and coordinates room status across the campus.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ClassCancellationRecord } from "./timetable-types.ts";
import {
  serverGetAllActiveCancellations,
  serverAddClassCancellation,
  serverRemoveClassCancellation,
  serverSettleClassCancellation,
} from "./cancellations.server.ts";

export const getAllActiveCancellationsServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return await serverGetAllActiveCancellations();
});

const AddCancellationSchema = z.object({
  id: z.string(),
  day: z.number().int().min(0).max(4),
  slot: z.number().int().min(0).max(4),
  batch: z.number().int().min(0),
  batchName: z.string(),
  room: z.number().int().min(0),
  roomName: z.string(),
  teacher: z.number().int().min(0),
  teacherName: z.string(),
  subject: z.number().int().min(0),
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
  .handler(async ({ data }) => {
    return await serverAddClassCancellation(data as ClassCancellationRecord);
  });

export const removeClassCancellationServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    return await serverRemoveClassCancellation(data.id);
  });

export const settleClassCancellationServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) =>
    z.object({ cancellationId: z.string(), makeupId: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    return await serverSettleClassCancellation(data.cancellationId, data.makeupId);
  });
