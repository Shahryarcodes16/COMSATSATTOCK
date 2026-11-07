/**
 * TanStack Start Server Functions for Student Authentication
 * Safe RPC boundary callable from client components with Zod schema validation
 * and signed httpOnly session cookie enforcement.
 *
 * NOTE: Account creation is strictly gated by studentVerifyAndSignUpFn.
 * Unverified sign-up is forbidden.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { StudentSession } from "./student";
import type { StudentAuthResponse } from "./student.server";

const StudentSignInSchema = z.object({
  email: z.string().email().min(5).max(120),
  password: z.string().min(1).max(128),
});

const StudentRequestCodeSchema = z.object({
  email: z.string().email().min(5).max(120),
  fullName: z.string().min(2).max(100),
  defaultBatch: z.string().max(50).optional(),
  originUrl: z.string().url().optional(),
});

const StudentVerifySchema = z.object({
  email: z.string().email().min(5).max(120),
  code: z.string().length(6),
  password: z.string().min(6).max(128),
});

const StudentUpdateBatchSchema = z.object({
  email: z.string().email().optional(),
  defaultBatch: z.string().min(1).max(50),
});

/**
 * Server Function: Student Sign In
 */
export const studentSignInFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => StudentSignInSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<StudentAuthResponse> => {
      const { serverStudentSignIn } = await import("./student.server.ts");
      return serverStudentSignIn(data.email, data.password);
    },
  );

/**
 * Server Function: Request Email Verification Code
 * Dispatches 6-digit OTP code to student's @cuiatk.edu.pk Gmail
 */
export const studentRequestVerificationCodeFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => StudentRequestCodeSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean;
      message?: string;
      devPreviewCode?: string;
      error?: string;
    }> => {
      const { serverRequestStudentVerificationCode } = await import("./student.server.ts");
      return serverRequestStudentVerificationCode(
        data.email,
        data.fullName,
        data.defaultBatch,
        data.originUrl,
      );
    },
  );

/**
 * Server Function: Verify 6-Digit Code and Create Student Account
 * The ONLY permitted entry point to register a student account.
 */
export const studentVerifyAndSignUpFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => StudentVerifySchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<StudentAuthResponse> => {
      const { serverVerifyCodeAndSignUp } = await import("./student.server.ts");
      return serverVerifyCodeAndSignUp(data.email, data.code, data.password);
    },
  );

/**
 * Server Function: Update Default Class Batch
 * Derives caller identity from signed httpOnly cookie (ignores untrusted client spoofing)
 */
export const studentUpdateBatchFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => StudentUpdateBatchSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; session?: StudentSession; error?: string }> => {
      const { requireStudentSession } = await import("./session.server.ts");
      const session = await requireStudentSession();
      const targetEmail = session.sub;
      const { serverStudentUpdateBatch } = await import("./student.server.ts");
      return serverStudentUpdateBatch(targetEmail, data.defaultBatch);
    },
  );

/**
 * Server Function: Student Sign Out
 * Clears signed httpOnly session cookie
 */
export const studentSignOutFn = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ success: boolean }> => {
    const { clearSessionCookie } = await import("./session.server.ts");
    await clearSessionCookie();
    return { success: true };
  });
