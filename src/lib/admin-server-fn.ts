/**
 * TanStack Start Server Functions for Admin Control Center
 * Enables cross-device synchronization between Laptop, Mobile, and Tablet.
 */
import { createServerFn } from "@tanstack/react-start";
import type { CampusNotice } from "./admin";

export interface AdminConfigResponse {
  passkey: string;
  campusNotice: CampusNotice | null;
  serverTime: string;
}

/**
 * Server Function: Get current admin configuration (passkey and active campus notice)
 */
export const getAdminConfigServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminConfigResponse> => {
    const { getServerAdminPasskey, getServerCampusNotice } = await import("./admin.server.ts");
    const [passkey, campusNotice] = await Promise.all([
      getServerAdminPasskey(),
      getServerCampusNotice(),
    ]);
    return {
      passkey,
      campusNotice,
      serverTime: new Date().toISOString(),
    };
  },
);

/**
 * Server Function: Update admin master passkey from any device
 */
export const updateAdminPasskeyServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: { email: string; currentOrMaster: string; newPasskey: string }) => data,
  )
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const { verifyAndSaveAdminPasskey } = await import("./admin.server.ts");
    return verifyAndSaveAdminPasskey(data.email, data.currentOrMaster, data.newPasskey);
  });

/**
 * Server Function: Update campus broadcast notice
 */
export const updateCampusNoticeServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      email: string;
      notice: Omit<CampusNotice, "id" | "updatedAt" | "updatedBy">;
    }) => data,
  )
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; error?: string; notice?: CampusNotice }> => {
      const { saveServerCampusNotice } = await import("./admin.server.ts");
      return saveServerCampusNotice(data.email, data.notice);
    },
  );

/**
 * Server Function: Clear campus broadcast notice
 */
export const clearCampusNoticeServerFn = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const { saveServerCampusNotice } = await import("./admin.server.ts");
    return saveServerCampusNotice(data.email, {
      enabled: false,
      title: "",
      message: "",
      type: "info",
    });
  });
