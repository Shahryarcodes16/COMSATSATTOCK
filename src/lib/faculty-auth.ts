/**
 * Faculty Authentication & Profile Module
 * Handles faculty email verification, timetable teacher linkages, and client-side session management.
 */
import { facultyList, type FacultyMember } from "./faculty.ts";
import { UNIVERSITY_EMAIL_REGEX } from "./student.ts";

export const FACULTY_SESSION_STORAGE_KEY = "cui_faculty_active_session_v1";
export const FACULTY_ACCOUNTS_VAULT_KEY = "cui_registered_faculty_vault_v1";

export interface FacultyProfile {
  id: string;
  email: string;
  fullName: string;
  teacherId: number | null;
  timetableName: string | null;
  department: string;
  designation?: string;
  notificationLeadMins: number; // 5 or 10 minutes before class
  createdAt: string;
}

export interface FacultySession {
  profile: FacultyProfile;
  token: string;
  signedInAt: string;
}

export interface LocalRegisteredFaculty {
  email: string;
  fullName: string;
  teacherId: number | null;
  timetableName: string | null;
  department: string;
  passwordHash: string;
  passwordSalt: string;
  notificationLeadMins: number;
  registeredAt?: string;
}

/**
 * Checks if an email is an official faculty or staff email.
 * It must be under @cuiatk.edu.pk or @ciit-attock.edu.pk and MUST NOT be a student email format.
 */
export function isFacultyEmail(email: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  
  // Must NOT match student email pattern
  if (UNIVERSITY_EMAIL_REGEX.test(clean)) {
    return false;
  }

  // Check known faculty list first
  const match = facultyList.find(
    (f) => f.email && f.email.trim().toLowerCase() === clean,
  );
  if (match) return true;

  // General university domain check
  return (
    clean.endsWith("@cuiatk.edu.pk") ||
    clean.endsWith("@ciit-attock.edu.pk") ||
    clean.endsWith("@comsats.edu.pk")
  );
}

/**
 * Finds the corresponding faculty directory entry for a given email
 */
export function matchFacultyByEmail(email: string): FacultyMember | null {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  return (
    facultyList.find((f) => f.email && f.email.trim().toLowerCase() === clean) ||
    null
  );
}

/**
 * Gets the active faculty session from client storage
 */
export function getActiveFacultySession(): FacultySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(FACULTY_SESSION_STORAGE_KEY) ||
      sessionStorage.getItem(FACULTY_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as FacultySession;
    if (session?.profile?.email && isFacultyEmail(session.profile.email)) {
      return session;
    }
  } catch {
    // Ignore invalid JSON
  }
  return null;
}

/**
 * Persists active faculty session
 */
export function setFacultySession(session: FacultySession, rememberMe = true): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(session);
    if (rememberMe) {
      localStorage.setItem(FACULTY_SESSION_STORAGE_KEY, serialized);
    } else {
      sessionStorage.setItem(FACULTY_SESSION_STORAGE_KEY, serialized);
    }
    window.dispatchEvent(new CustomEvent("cui:faculty-session-update", { detail: session }));
  } catch (err) {
    console.error("Failed to persist faculty session", err);
  }
}

/**
 * Clears the active faculty session (Logout)
 */
export function clearFacultySession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(FACULTY_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(FACULTY_SESSION_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("cui:faculty-session-update", { detail: null }));
  } catch (err) {
    console.error("Failed to clear faculty session", err);
  }
}

/**
 * Saves faculty account in the persistent local vault (survives cold starts)
 */
export function saveLocalFacultyAccount(account: LocalRegisteredFaculty): void {
  if (typeof window === "undefined") return;
  try {
    const vault = getLocalFacultyAccounts();
    vault[account.email.toLowerCase()] = {
      ...account,
      registeredAt: account.registeredAt || new Date().toISOString(),
    };
    localStorage.setItem(FACULTY_ACCOUNTS_VAULT_KEY, JSON.stringify(vault));
  } catch (err) {
    console.error("Failed to save faculty account in local vault", err);
  }
}

/**
 * Retrieves all registered faculty accounts on this device
 */
export function getLocalFacultyAccounts(): Record<string, LocalRegisteredFaculty> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(FACULTY_ACCOUNTS_VAULT_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Retrieves a single faculty account from the local vault
 */
export function getLocalFacultyAccount(email: string): LocalRegisteredFaculty | null {
  const vault = getLocalFacultyAccounts();
  return vault[email.trim().toLowerCase()] || null;
}
