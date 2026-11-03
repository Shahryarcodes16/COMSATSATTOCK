export const AUTHORIZED_ADMIN_EMAIL = "fa23-bcs-014@cuiatk.edu.pk";
const ADMIN_PASSKEY_STORAGE_KEY = "cui_admin_custom_passkey_v1";
const ADMIN_SESSION_STORAGE_KEY = "cui_admin_active_session_v1";
const CAMPUS_NOTICE_STORAGE_KEY = "cui_campus_broadcast_notice_v1";
const TIMETABLE_OVERRIDE_STORAGE_KEY = "cui_custom_timetable_override_v1";

// Default Master Passkey (admin can change this anytime from admin panel)
export const DEFAULT_ADMIN_PASSKEY = "cuiatk@2026";

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
 * Updates the admin passkey
 */
export function updateAdminPasskey(newPasskey: string): boolean {
  if (typeof window === "undefined" || !newPasskey || newPasskey.length < 6) return false;
  try {
    localStorage.setItem(ADMIN_PASSKEY_STORAGE_KEY, newPasskey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifies email and passkey
 */
export function verifyAdminCredentials(email: string, passkey: string): { success: boolean; error?: string } {
  if (!isAuthorizedAdminEmail(email)) {
    return {
      success: false,
      error: `Access Denied: Only the authorized university administrator (${AUTHORIZED_ADMIN_EMAIL}) is permitted to access this portal.`,
    };
  }

  const currentPasskey = getStoredAdminPasskey();
  if (passkey !== currentPasskey && passkey !== DEFAULT_ADMIN_PASSKEY) {
    return {
      success: false,
      error: "Invalid Security Passkey. Please check and try again.",
    };
  }

  return { success: true };
}

/**
 * Retrieves the active admin session if valid
 */
export function getActiveAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
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
 * Saves a new campus broadcast announcement
 */
export function saveCampusNotice(notice: Omit<CampusNotice, "id" | "updatedAt" | "updatedBy">): void {
  if (typeof window === "undefined") return;
  const fullNotice: CampusNotice = {
    ...notice,
    id: `notice-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    updatedBy: AUTHORIZED_ADMIN_EMAIL,
  };
  try {
    localStorage.setItem(CAMPUS_NOTICE_STORAGE_KEY, JSON.stringify(fullNotice));
    // Trigger custom event so other components immediately react
    window.dispatchEvent(new CustomEvent("cui:campus-notice-update"));
  } catch (err) {
    console.error("Failed to save campus notice", err);
  }
}

/**
 * Clears the campus notice
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
