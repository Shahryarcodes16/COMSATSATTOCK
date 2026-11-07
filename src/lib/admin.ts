export const AUTHORIZED_ADMIN_EMAIL = "fa23-bcs-014@cuiatk.edu.pk";
const ADMIN_SESSION_STORAGE_KEY = "cui_admin_active_session_v1";
const CAMPUS_NOTICE_STORAGE_KEY = "cui_campus_broadcast_notice_v1";

export interface CampusNotice {
  id: string;
  enabled: boolean;
  title: string;
  message: string;
  type: "info" | "warning" | "urgent" | "success";
  updatedAt: string;
  updatedBy: string;
}

export interface AdminSession {
  email: string;
  token: string;
  signedInAt: string;
}

/**
 * Validates if an email is the authorized admin email
 */
export function isAuthorizedAdminEmail(email: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();
}

/**
 * Synchronizes campus notice from server to client storage
 */
export async function syncAdminDataFromServer(): Promise<{
  notice: CampusNotice | null;
} | null> {
  if (typeof window === "undefined") return null;
  try {
    const { getAdminConfigServerFn } = await import("./admin-server-fn");
    const config = await getAdminConfigServerFn();
    if (config?.campusNotice) {
      localStorage.setItem(CAMPUS_NOTICE_STORAGE_KEY, JSON.stringify(config.campusNotice));
      window.dispatchEvent(new CustomEvent("cui:campus-notice-update"));
    }
    return { notice: config.campusNotice };
  } catch (err) {
    console.warn("Failed to sync admin notice from server:", err);
    return null;
  }
}

/**
 * Server-backed verification of admin credentials.
 * The server never returns the passkey; it validates it securely on the server and issues an httpOnly cookie.
 */
export async function verifyAdminCredentialsAsync(
  email: string,
  passkey: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { adminSignInFn } = await import("./admin-server-fn");
    const res = await adminSignInFn({
      data: {
        email: email.trim().toLowerCase(),
        passkey: passkey.trim(),
      },
    });
    return res;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to authenticate with server.",
    };
  }
}

/**
 * Cross-device reset: updates passkey on the server using authenticated session
 */
export async function resetAdminPasskeyWithAuthAsync(
  currentPasskey: string,
  newPasskey: string,
): Promise<{ success: boolean; error?: string }> {
  if (!newPasskey || newPasskey.trim().length < 8) {
    return {
      success: false,
      error: "New passkey must be at least 8 characters long.",
    };
  }

  try {
    const { updateAdminPasskeyServerFn } = await import("./admin-server-fn");
    const res = await updateAdminPasskeyServerFn({
      data: {
        currentPasskey: currentPasskey.trim(),
        newPasskey: newPasskey.trim(),
      },
    });
    return res;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to update passkey on server.",
    };
  }
}

/**
 * Retrieves the active admin session if valid
 */
export function getActiveAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) ||
      localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    if (session && isAuthorizedAdminEmail(session.email)) {
      return session;
    }
  } catch {
    // Ignore invalid JSON
  }
  return null;
}

/**
 * Establishes an admin session on the client
 */
export function setAdminSession(email: string, rememberMe = true): void {
  if (typeof window === "undefined") return;
  const session: AdminSession = {
    email: email.trim().toLowerCase(),
    token: `cui-adm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    signedInAt: new Date().toISOString(),
  };

  const payload = JSON.stringify(session);
  try {
    sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, payload);
    if (rememberMe) {
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, payload);
    }
  } catch (err) {
    console.error("Failed to store admin session", err);
  }
}

/**
 * Clears the active admin session (Logout)
 */
export async function clearAdminSession(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    const { adminSignOutFn } = await import("./admin-server-fn");
    await adminSignOutFn();
  } catch (err) {
    console.error("Failed to clear admin session", err);
  }
}

/**
 * Retrieves the global campus announcement notice
 */
export function getCampusNotice(): CampusNotice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CAMPUS_NOTICE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampusNotice;
    return parsed.enabled ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Saves a new campus broadcast announcement locally
 */
export function saveCampusNotice(
  notice: Omit<CampusNotice, "id" | "updatedAt" | "updatedBy">,
): void {
  if (typeof window === "undefined") return;
  const fullNotice: CampusNotice = {
    ...notice,
    id: `notice-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    updatedBy: AUTHORIZED_ADMIN_EMAIL,
  };
  try {
    localStorage.setItem(CAMPUS_NOTICE_STORAGE_KEY, JSON.stringify(fullNotice));
    window.dispatchEvent(new CustomEvent("cui:campus-notice-update"));
  } catch (err) {
    console.error("Failed to save campus notice", err);
  }
}

/**
 * Saves a new campus broadcast announcement across all devices
 */
export async function saveCampusNoticeAsync(
  notice: Omit<CampusNotice, "id" | "updatedAt" | "updatedBy">,
): Promise<void> {
  saveCampusNotice(notice);
  try {
    const { updateCampusNoticeServerFn } = await import("./admin-server-fn");
    await updateCampusNoticeServerFn({
      data: {
        notice,
      },
    });
  } catch (err) {
    console.warn("Failed to broadcast campus notice to server:", err);
  }
}

/**
 * Clears the campus notice locally
 */
export function clearCampusNotice(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CAMPUS_NOTICE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("cui:campus-notice-update"));
  } catch (err) {
    console.error("Failed to clear notice", err);
  }
}

/**
 * Clears the campus notice across all devices
 */
export async function clearCampusNoticeAsync(): Promise<void> {
  clearCampusNotice();
  try {
    const { clearCampusNoticeServerFn } = await import("./admin-server-fn");
    await clearCampusNoticeServerFn();
  } catch (err) {
    console.warn("Failed to clear notice on server:", err);
  }
}
