/**
 * TanStack Start Server Functions for Web Push Notifications
 * Manages device push subscriptions and test push triggers
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getVapidPublicKeyServerFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<{ publicKey: string }> => {
  const { VAPID_PUBLIC_KEY } = await import("./push.server.ts");
  return { publicKey: VAPID_PUBLIC_KEY };
});

const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userType: z.enum(["student", "faculty"]).optional(),
  batchId: z.number().nullable().optional(),
  teacherId: z.number().nullable().optional(),
  leadMinutes: z.number().int().min(1).max(60).optional(),
});

export const savePushSubscriptionServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => PushSubscriptionSchema.parse(d))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const { savePushSubscription } = await import("./push.server.ts");
    const ok = await savePushSubscription(data);
    return { success: ok };
  });

const TestPushSchema = z.object({
  endpoint: z.string().url(),
});

export const sendTestPushServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => TestPushSchema.parse(d))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const { sendTestPushToEndpoint } = await import("./push.server.ts");
    const ok = await sendTestPushToEndpoint(data.endpoint);
    return { success: ok };
  });
