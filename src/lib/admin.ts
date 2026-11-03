export const AUTHORIZED_ADMIN_EMAIL = "fa23-bcs-014@cuiatk.edu.pk";
const ADMIN_PASSKEY_STORAGE_KEY = "cui_admin_custom_passkey_v1";
const ADMIN_SESSION_STORAGE_KEY = "cui_admin_active_session_v1";
const CAMPUS_NOTICE_STORAGE_KEY = "cui_campus_broadcast_notice_v1";
const TIMETABLE_OVERRIDE_STORAGE_KEY = "cui_custom_timetable_override_v1";

// Default Master Passkey (admin can change this anytime from admin panel)
export const DEFAULT_ADMIN_PASSKEY = "cuiatk@2026";
export const MASTER_STUDENT_ROLL_PIN = "014";

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
 * Gets the current configured passkey
 */
export function getStoredAdminPasskey(): string {
  if (typeof window === "undefined") return DEFAULT_ADMIN_PASSKEY;
  try {
    const custom = localStorage.getItem(ADMIN_PASSKEY_STORAGE_KEY);
    return custom || DEFAULT_ADMIN_PASSKEY;
  } catch {
    return DEFAULT_ADMIN_PASSKEY;
  }
}

/**
 * Updates the admin passkey locally
 */
export function updateAdminPasskey(newPasskey: string): boolean {
  if (typeof window === "undefined" || !newPasskey || newPasskey.trim().length < 4) return false;
  try {
    localStorage.setItem(ADMIN_PASSKEY_STORAGE_KEY, newPasskey.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronizes admin settings from server (TanStack Start RPC) to local storage.
 * Keeps laptop and mobile devices in sync.
 */
export async function syncAdminDataFromServer(): Promise<{
  passkey: string;
  notice: CampusNotice | null;
} | null> {
  if (typeof window === "undefined") return null;
  try {
    const { getAdminConfigServerFn } = await import("./admin-server-fn");
    const config = await getAdminConfigServerFn();
    if (config?.passkey) {
      localStorage.setItem(ADMIN_PASSKEY_STORAGE_KEY, config.passkey);
    }
    if (config?.campusNotice) {
      localStorage.setItem(CAMPUS_NOTICE_STORAGE_KEY, JSON.stringify(config.campusNotice));
      window.dispatchEvent(new CustomEvent("cui:campus-notice-update"));
    }
    return { passkey: config.passkey, notice: config.campusNotice };
  } catch (err) {
    console.warn("Failed to sync admin config from server:", err);
    return null;
  }
}

/**
 * Validates and resets passkey using current passkey or student roll PIN (014)
 * Synchronous local version
 */
export function resetAdminPasskeyWithAuth(
  email: string,
  currentOrMaster: string,
  newPasskey: string,
): { success: boolean; error?: string } {
  if (!isAuthorizedAdminEmail(email)) {
    return {
      success: false,
      error: "Unauthorized: only the designated campus administrator can perform this action.",
    };
  }
  const current = getStoredAdminPasskey();
  const trimmedInput = (currentOrMaster || "").trim();
  if (
    trimmedInput !== current &&
    trimmedInput !== DEFAULT_ADMIN_PASSKEY &&
    trimmedInput !== MASTER_STUDENT_ROLL_PIN
  ) {
    return {
      success: false,
      error: "Current passkey or student roll PIN (014) is incorrect.",
    };
  }
  if (!newPasskey || newPasskey.trim().length < 4) {
    return {
      success: false,
      error: "New passkey must be at least 4 characters long.",
    };
  }
  const ok = updateAdminPasskey(newPasskey);
  return ok ? { success: true } : { success: false, error: "Failed to save new passkey." };
}

/**
 * Cross-device reset: updates both server database and local storage
 */
export async function resetAdminPasskeyWithAuthAsync(
  email: string,
  currentOrMaster: string,
  newPasskey: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isAuthorizedAdminEmail(email)) {
    return {
      success: false,
      error: "Unauthorized: only the designated campus administrator can perform this action.",
    };
  }
  if (!newPasskey || newPasskey.trim().length < 4) {
    return {
      success: false,
      error: "New passkey must be at least 4 characters long.",
    };
  }

  // Update local storage immediately
  updateAdminPasskey(newPasskey.trim());

  // Update server storage so mobile & laptop sync
  try {
    const { updateAdminPasskeyServerFn } = await import("./admin-server-fn");
    const res = await updateAdminPasskeyServerFn({
      data: {
        email: email.trim().toLowerCase(),
        currentOrMaster: currentOrMaster.trim(),
        newPasskey: newPasskey.trim(),
      },
    });
    if (!res.success && res.error) {
      return res;
    }
    return { success: true };
  } catch (err) {
    console.warn("Failed to sync passkey update to server:", err);
    return { success: true };
  }
}

/**
 * Synchronous local verification of email and passkey.
 * Recognizes master student PIN (014), custom passkey, and default passkey.
 */
export function verifyAdminCredentials(
  email: string,
  passkey: string,
): { success: boolean; error?: string } {
  if (!isAuthorizedAdminEmail(email)) {
    return {
      success: false,
      error: "Access Denied: Invalid administrator credentials or unauthorized email.",
    };
  }

  const currentPasskey = getStoredAdminPasskey();
  const trimmed = (passkey || "").trim();

  // Allow direct login via:
  // 1. Master Student PIN '014' (always authorized for fa23-bcs-014)
  // 2. Custom stored passkey
  // 3. Default campus admin passkey
  if (
    trimmed === MASTER_STUDENT_ROLL_PIN ||
    trimmed === currentPasskey ||
    trimmed === DEFAULT_ADMIN_PASSKEY
  ) {
    return { success: true };
  }

  return {
    success: false,
    error: "Invalid Security Passkey. Please verify and try again.",
  };
}

/**
 * Asynchronous cross-device verification.
 * If the local device does not recognize the passkey (e.g., entered on laptop, logging in on mobile),
 * checks the server and updates local device cache on match.
 */
export async function verifyAdminCredentialsAsync(
  email: string,
  passkey: string,
): Promise<{ success: boolean; error?: string; synced?: boolean }> {
  const localCheck = verifyAdminCredentials(email, passkey);
  if (localCheck.success) {
    return localCheck;
  }

  // If local device check fails, verify with server in case passkey was changed on another device
  try {
    const { getAdminConfigServerFn } = await import("./admin-server-fn");
    const config = await getAdminConfigServerFn();
    const trimmed = (passkey || "").trim();
    if (
      config?.passkey &&
      (trimmed === config.passkey.trim() ||
        trimmed === MASTER_STUDENT_ROLL_PIN ||
        trimmed === DEFAULT_ADMIN_PASSKEY)
    ) {
      // Sync to current device's local storage so subsequent logins are instant
      updateAdminPasskey(config.passkey);
      return { success: true, synced: true };
    }
  } catch (err) {
    console.warn("Server passkey verification unreachable:", err);
  }

  return {
    success: false,
    error: "Invalid Security Passkey. Please verify and try again.",
  };
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
 * Establishes an admin session
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
export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
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
        email: AUTHORIZED_ADMIN_EMAIL,
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
    await clearCampusNoticeServerFn({
      data: {
        email: AUTHORIZED_ADMIN_EMAIL,
      },
    });
  } catch (err) {
    console.warn("Failed to clear notice on server:", err);
  }
}
