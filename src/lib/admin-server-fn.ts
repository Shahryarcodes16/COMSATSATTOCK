/**
 * TanStack Start Server Functions for Admin Control Center
 * Implements strict RPC boundaries with Zod validation and authenticated session checks.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CampusNotice } from "./admin";

export interface AdminConfigResponse {
  campusNotice: CampusNotice | null;
  serverTime: string;
}

/**
 * Server Function: Get current admin public configuration (campus notice only).
 * Never exposes passwords or passkeys to client browsers.
 */
export const getAdminConfigServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminConfigResponse> => {
    const { getServerCampusNotice } = await import("./admin.server.ts");
    const campusNotice = await getServerCampusNotice();
    return {
      campusNotice,
      serverTime: new Date().toISOString(),
    };
  },
);

/**
 * Server Function: Admin Sign In
 * Validates credentials entirely on the server and issues an httpOnly session cookie.
 */
export const adminSignInFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email("Invalid email format"),
      passkey: z.string().min(1, "Passkey is required"),
    }),
  )
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const { verifyAdminLoginServer } = await import("./admin.server.ts");
    return verifyAdminLoginServer(data.email, data.passkey);
  });

/**
 * Server Function: Admin Sign Out
 * Clears the secure session cookie.
 */
export const adminSignOutFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ success: boolean }> => {
    const { clearSessionCookie } = await import("./session.server.ts");
    await clearSessionCookie();
    return { success: true };
  },
);

/**
 * Server Function: Update admin master passkey
 * Requires an active admin session and current passkey verification.
 */
export const updateAdminPasskeyServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      currentPasskey: z.string().min(1, "Current passkey is required"),
      newPasskey: z.string().min(8, "New passkey must be at least 8 characters long"),
    }),
  )
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const { updateAdminPasskeyServer } = await import("./admin.server.ts");
    return updateAdminPasskeyServer(data.currentPasskey, data.newPasskey);
  });

/**
 * Server Function: Update campus broadcast notice
 * Requires an active admin session.
 */
export const updateCampusNoticeServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      notice: z.object({
        enabled: z.boolean(),
        title: z.string().max(200, "Title is too long (max 200 chars)"),
        message: z.string().max(2000, "Message is too long (max 2000 chars)"),
        type: z.enum(["info", "warning", "urgent", "success"]),
      }),
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; error?: string; notice?: CampusNotice }> => {
      const { saveServerCampusNotice } = await import("./admin.server.ts");
      return saveServerCampusNotice(data.notice);
    },
  );

/**
 * Server Function: Clear campus broadcast notice
 * Requires an active admin session.
 */
export const clearCampusNoticeServerFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ success: boolean; error?: string }> => {
    const { clearServerCampusNotice } = await import("./admin.server.ts");
    return clearServerCampusNotice();
  },
);
