/**
 * Official Academic & Timetable Coordinator Module
 * Empowers the university's designated class coordinator to create an official account
 * with their official university email (@cuiatk.edu.pk, @ciit-attock.edu.pk, @comsats.edu.pk),
 * sign in securely, and arrange classes on behalf of students.
 */
import { addMakeupClassAsync, removeMakeupClass, getActiveArrangedMakeupClasses, type MakeupClassRecord } from "./makeup-classes.ts";
import { UNIVERSITY_EMAIL_REGEX } from "./student.ts";

export const COORDINATOR_SESSION_STORAGE_KEY = "cui_coordinator_active_session_v1";
export const COORDINATOR_ACCOUNTS_VAULT_KEY = "cui_registered_coordinator_vault_v1";
export const COORDINATOR_EVENT = "cui:coordinator-session-update";

export interface CoordinatorProfile {
  id: string;
  email: string;
  fullName: string;
  department: string;
  designation: string;
  createdAt: string;
}

export interface CoordinatorSession {
  role: "coordinator";
  profile: CoordinatorProfile;
  token: string;
  signedInAt: string;
}

export interface LocalRegisteredCoordinator {
  id?: string;
  email: string;
  fullName: string;
  department?: string;
  designation?: string;
  passwordHash: string;
  passwordSalt: string;
  registeredAt?: string;
}

/**
 * Validates if an email is an official faculty/staff university email suitable for a coordinator.
 * It must end with @cuiatk.edu.pk, @ciit-attock.edu.pk, or @comsats.edu.pk,
 * and must NOT be a student roll number email.
 */
export function isCoordinatorEmail(email: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (UNIVERSITY_EMAIL_REGEX.test(clean)) {
    return false;
  }
  return (
    clean.endsWith("@cuiatk.edu.pk") ||
    clean.endsWith("@ciit-attock.edu.pk") ||
    clean.endsWith("@comsats.edu.pk")
  );
}

/**
 * Retrieves the currently active Coordinator session from storage.
 */
export function getActiveCoordinatorSession(): CoordinatorSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(COORDINATOR_SESSION_STORAGE_KEY) ||
      sessionStorage.getItem(COORDINATOR_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoordinatorSession;
    if (parsed && parsed.role === "coordinator" && parsed.profile?.email && isCoordinatorEmail(parsed.profile.email)) {
      return parsed;
    }
  } catch {
    // Ignore JSON errors
  }
  return null;
}

/**
 * Persists the Coordinator session and broadcasts the update.
 */
export function setCoordinatorSession(session: CoordinatorSession, remember: boolean = true) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(session);
  if (remember) {
    localStorage.setItem(COORDINATOR_SESSION_STORAGE_KEY, serialized);
    sessionStorage.removeItem(COORDINATOR_SESSION_STORAGE_KEY);
  } else {
    sessionStorage.setItem(COORDINATOR_SESSION_STORAGE_KEY, serialized);
    localStorage.removeItem(COORDINATOR_SESSION_STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent(COORDINATOR_EVENT, { detail: session }));
}

/**
 * Clears the Coordinator session and broadcasts the logout event.
 */
export function clearCoordinatorSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(COORDINATOR_SESSION_STORAGE_KEY);
  sessionStorage.removeItem(COORDINATOR_SESSION_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(COORDINATOR_EVENT, { detail: null }));
}

/**
 * Local Vault Management for Coordinator Accounts
 */
export function getLocalCoordinatorAccounts(): Record<string, LocalRegisteredCoordinator> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COORDINATOR_ACCOUNTS_VAULT_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getLocalCoordinatorAccount(email: string): LocalRegisteredCoordinator | null {
  const vault = getLocalCoordinatorAccounts();
  return vault[email.trim().toLowerCase()] || null;
}

export function saveLocalCoordinatorAccount(account: LocalRegisteredCoordinator): void {
  if (typeof window === "undefined") return;
  try {
    const vault = getLocalCoordinatorAccounts();
    vault[account.email.toLowerCase()] = {
      ...account,
      registeredAt: account.registeredAt || new Date().toISOString(),
    };
    localStorage.setItem(COORDINATOR_ACCOUNTS_VAULT_KEY, JSON.stringify(vault));
  } catch (err) {
    console.error("Failed to save coordinator account in local vault", err);
  }
}

/**
 * PBKDF2/SHA-512 client crypto helpers
 */
export function generateCoordinatorSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashCoordinatorPasswordClient(password: string, salt: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API not available");
  }
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 10000,
      hash: "SHA-512",
    },
    keyMaterial,
    512,
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyCoordinatorPasswordClient(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  try {
    const calculated = await hashCoordinatorPasswordClient(password, salt);
    return calculated.toLowerCase() === hash.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Arranges an official class on behalf of a student / batch.
 * This directly updates the whole campus timetable in real-time.
 */
export async function coordinatorArrangeClass(params: {
  day: number;
  slot: number;
  batch: number;
  room: number;
  teacher: number;
  subject: number;
  studentRequesterName?: string;
  studentRequesterRegNo?: string;
  reason?: string;
}): Promise<{ success: boolean; record?: MakeupClassRecord; error?: string }> {
  try {
    const session = getActiveCoordinatorSession();
    const coordinatorEmail = session?.profile.email || "coordinator@cuiatk.edu.pk";
    const coordinatorName = session?.profile.fullName || "Academic Coordinator";

    const studentInfo = [
      params.studentRequesterRegNo?.trim(),
      params.studentRequesterName?.trim(),
    ].filter(Boolean).join(" - ");

    const notePrefix = studentInfo ? `[Requested by Student: ${studentInfo}]` : `[Arranged by ${coordinatorName}]`;
    const fullNote = params.reason?.trim()
      ? `${notePrefix} ${params.reason.trim()}`
      : `${notePrefix} Official lecture / makeup session arranged by Academic Coordinator (${coordinatorName}).`;

    const res = await addMakeupClassAsync({
      day: params.day,
      slot: params.slot,
      batch: params.batch,
      room: params.room,
      teacher: params.teacher,
      subject: params.subject,
      note: fullNote,
      createdByEmail: coordinatorEmail,
    });

    return { success: true, record: res.record };
  } catch (err: any) {
    console.error("[coordinator] Error arranging class:", err);
    return { success: false, error: err?.message || "Failed to arrange class on timetable." };
  }
}

/**
 * Cancels / releases an arranged class from the timetable.
 */
export async function coordinatorCancelArrangedClass(recordId: string): Promise<boolean> {
  try {
    removeMakeupClass(recordId);
    return true;
  } catch {
    return false;
  }
}
