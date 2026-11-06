/**
 * TanStack Start Server Functions for Faculty Authentication & Settings
 * Safe RPC boundary callable from client components.
 */
import { createServerFn } from "@tanstack/react-start";
import type { FacultySession } from "./faculty-auth";
import type { FacultyAuthResponse } from "./faculty.server";

/**
 * Server Function: Request Faculty Email Verification Code
 */
export const facultyRequestVerificationCodeFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      email: string;
      fullName: string;
      teacherId?: number;
      originUrl?: string;
    }) => data,
  )
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
  .validator(
    (data: {
      email: string;
      code: string;
      password: string;
      teacherId?: number;
    }) => data,
  )
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
  .validator((data: { email: string; password: string }) => data)
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
 */
export const facultyUpdateLeadTimeFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; leadMins: number }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; session?: FacultySession; error?: string }> => {
      const { serverFacultyUpdateLeadTime } = await import("./faculty.server.ts");
      return serverFacultyUpdateLeadTime(data.email, data.leadMins);
    },
  );
