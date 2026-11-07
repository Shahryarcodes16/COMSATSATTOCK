/**
 * TanStack Start Server Functions for Faculty Authentication & Settings
 * Safe RPC boundary callable from client components with Zod schema validation
 * and signed httpOnly session cookie enforcement.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { FacultySession } from "./faculty-auth";
import type { FacultyAuthResponse } from "./faculty.server";

const FacultyRequestCodeSchema = z.object({
  email: z.string().email().min(5).max(120),
  fullName: z.string().min(2).max(100),
  teacherId: z.number().int().positive().optional(),
  originUrl: z.string().url().optional(),
});

const FacultyVerifySchema = z.object({
  email: z.string().email().min(5).max(120),
  code: z.string().length(6),
  password: z.string().min(6).max(128),
  teacherId: z.number().int().positive().optional(),
});

const FacultySignInSchema = z.object({
  email: z.string().email().min(5).max(120),
  password: z.string().min(1).max(128),
});

const FacultyUpdateLeadTimeSchema = z.object({
  email: z.string().email().optional(),
  leadMins: z.number().int().min(1).max(60),
});

/**
 * Server Function: Request Faculty Email Verification Code
 */
export const facultyRequestVerificationCodeFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => FacultyRequestCodeSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean;
      message?: string;
      devPreviewCode?: string;
      error?: string;
    }> => {
      const { serverRequestFacultyVerificationCode } = await import("./faculty.server.ts");
      return serverRequestFacultyVerificationCode(
        data.email,
        data.fullName,
        data.teacherId,
        data.originUrl,
      );
    },
  );

/**
 * Server Function: Verify 6-Digit Code and Create Faculty Account
 */
export const facultyVerifyAndSignUpFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => FacultyVerifySchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<FacultyAuthResponse> => {
      const { serverVerifyFacultyCodeAndSignUp } = await import("./faculty.server.ts");
      return serverVerifyFacultyCodeAndSignUp(
        data.email,
        data.code,
        data.password,
        data.teacherId,
      );
    },
  );

/**
 * Server Function: Faculty Sign In
 */
export const facultySignInFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => FacultySignInSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<FacultyAuthResponse> => {
      const { serverFacultySignIn } = await import("./faculty.server.ts");
      return serverFacultySignIn(data.email, data.password);
    },
  );

/**
 * Server Function: Update Pre-Class Notification Lead Time (5 or 10 mins)
 * Derives caller identity strictly from authenticated signed session cookie
 */
export const facultyUpdateLeadTimeFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => FacultyUpdateLeadTimeSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; session?: FacultySession; error?: string }> => {
      const { requireFacultySession } = await import("./session.server.ts");
      const session = await requireFacultySession();
      const targetEmail = session.sub;
      const { serverFacultyUpdateLeadTime } = await import("./faculty.server.ts");
      return serverFacultyUpdateLeadTime(targetEmail, data.leadMins);
    },
  );

/**
 * Server Function: Faculty Sign Out
 * Clears signed httpOnly session cookie
 */
export const facultySignOutFn = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ success: boolean }> => {
    const { clearSessionCookie } = await import("./session.server.ts");
    await clearSessionCookie();
    return { success: true };
  });
