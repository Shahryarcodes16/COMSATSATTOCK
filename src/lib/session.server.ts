/**
 * Server-only Session & Security Token Management Layer
 * Uses signed, httpOnly, SameSite=Lax JWT cookies powered by 'jose'.
 * Guarantees that client requests cannot spoof identities or tamper with session data.
 */
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getCookie, setCookie } from "@tanstack/react-start/server";

export const SESSION_COOKIE_NAME = "cui_session_token";
export const CHALLENGE_COOKIE_NAME = "cui_challenge_token";

export interface SessionPayload {
  sub: string; // User email (normalized lowercase)
  role: "student" | "faculty" | "admin";
  name?: string;
  batch?: string;
  teacherId?: number | null;
  iat?: number;
  exp?: number;
}

export interface ChallengePayload {
  email: string;
  fullName: string;
  codeHash: string;
  defaultBatch?: string;
  exp: number;
}

// In-memory runtime ephemeral secret. Generated fresh per process instance if SESSION_SECRET is not configured.
// This guarantees:
// 1. Zero static secrets stored in public GitHub.
// 2. An attacker reading source code cannot forge tokens.
// 3. The server never crashes with a 500 error if environment variables take time to propagate across Vercel regions.
let runtimeEphemeralSecret: Uint8Array | null = null;

// Secret key for HMAC-SHA256 signing
function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.BETTER_AUTH_SECRET;
  if (secret && secret.trim().length >= 32) {
    return new TextEncoder().encode(secret.trim());
  }

  if (!runtimeEphemeralSecret) {
    runtimeEphemeralSecret = crypto.randomBytes(32);
    console.warn(
      "[session.server] SESSION_SECRET not detected or shorter than 32 chars. Using secure in-memory ephemeral secret.",
    );
  }
  return runtimeEphemeralSecret;
}

/**
 * Creates and sets an httpOnly signed challenge cookie for stateless serverless OTP verification
 */
export async function setChallengeCookie(payload: Omit<ChallengePayload, "exp">): Promise<void> {
  const secret = getSessionSecret();
  const token = await new SignJWT({
    email: payload.email.toLowerCase(),
    fullName: payload.fullName,
    codeHash: payload.codeHash,
    defaultBatch: payload.defaultBatch,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);

  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  setCookie(CHALLENGE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });
}

/**
 * Reads and verifies the active stateless challenge cookie from request
 */
export async function getChallengeCookie(): Promise<ChallengePayload | null> {
  try {
    const token = getCookie(CHALLENGE_COOKIE_NAME);
    if (!token) return null;

    const secret = getSessionSecret();
    const { payload } = await jwtVerify(token, secret);

    if (!payload.email || typeof payload.email !== "string" || !payload.codeHash) {
      return null;
    }

    return {
      email: payload.email.toLowerCase(),
      fullName: String(payload.fullName || ""),
      codeHash: String(payload.codeHash),
      defaultBatch: payload.defaultBatch ? String(payload.defaultBatch) : undefined,
      exp: typeof payload.exp === "number" ? payload.exp * 1000 : Date.now() + 600000,
    };
  } catch {
    return null;
  }
}

/**
 * Clears the challenge cookie
 */
export async function clearChallengeCookie(): Promise<void> {
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  setCookie(CHALLENGE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Creates a signed JWT and sets an httpOnly, Secure cookie in the response.
 */
export async function createAndSetSessionCookie(
  payload: Omit<SessionPayload, "iat" | "exp">,
): Promise<string> {
  const secret = getSessionSecret();
  const normalizedEmail = payload.sub.trim().toLowerCase();

  const token = await new SignJWT({
    ...payload,
    sub: normalizedEmail,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d") // 30-day session
    .sign(secret);

  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  try {
    setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    });
  } catch {
    // Graceful fallback for non-HTTP test / background contexts
  }

  return token;
}

/**
 * Clears the session cookie on logout.
 */
export async function clearSessionCookie(): Promise<void> {
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  try {
    setCookie(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  } catch {
    // Graceful fallback for non-HTTP contexts
  }
}

/**
 * Verifies and returns the active server session from request cookies.
 * Returns null if missing, expired, or invalid.
 */
export async function getServerSession(): Promise<SessionPayload | null> {
  try {
    const token = getCookie(SESSION_COOKIE_NAME);
    if (!token) return null;

    const secret = getSessionSecret();
    const { payload } = await jwtVerify(token, secret);

    if (!payload.sub || typeof payload.sub !== "string") {
      return null;
    }

    const role = (payload.role as "student" | "faculty" | "admin") || "student";

    return {
      sub: payload.sub.toLowerCase(),
      role,
      name: typeof payload.name === "string" ? payload.name : undefined,
      batch: typeof payload.batch === "string" ? payload.batch : undefined,
      teacherId: typeof payload.teacherId === "number" ? payload.teacherId : null,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Enforces authentication on server actions. Throws an error if no valid session exists.
 */
export async function requireSession(
  allowedRoles?: Array<"student" | "faculty" | "admin">,
): Promise<SessionPayload> {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Authentication required. Please sign in to perform this action.");
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    throw new Error(`Unauthorized. This action requires one of the following roles: ${allowedRoles.join(", ")}.`);
  }

  return session;
}

/**
 * Specialized helper: Enforces a verified student session.
 */
export async function requireStudentSession(): Promise<SessionPayload> {
  return requireSession(["student", "admin"]);
}

/**
 * Specialized helper: Enforces a verified faculty session.
 */
export async function requireFacultySession(): Promise<SessionPayload> {
  return requireSession(["faculty", "admin"]);
}

/**
 * Specialized helper: Enforces a verified admin session.
 */
export async function requireAdminSession(): Promise<SessionPayload> {
  return requireSession(["admin"]);
}
