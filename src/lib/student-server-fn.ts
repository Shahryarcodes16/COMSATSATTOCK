/**
 * TanStack Start Server Functions for Student Authentication
 * Safe RPC boundary callable from client components.
 */
import { createServerFn } from "@tanstack/react-start";
import type { StudentSession } from "./student";
import type { StudentAuthResponse } from "./student.server";

/**
 * Server Function: Student Sign Up
 */
export const studentSignUpFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      email: string;
      fullName: string;
      password: string;
      defaultBatch?: string;
    }) => data,
  )
  .handler(
    async ({
      data,
    }): Promise<StudentAuthResponse> => {
      const { serverStudentSignUp } = await import("./student.server.ts");
      return serverStudentSignUp(
        data.email,
        data.fullName,
        data.password,
        data.defaultBatch,
      );
    },
  );

/**
 * Server Function: Student Sign In
 */
export const studentSignInFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
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
  .validator(
    (data: {
      email: string;
      fullName: string;
      defaultBatch?: string;
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
 */
export const studentVerifyAndSignUpFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      email: string;
      code: string;
      password: string;
    }) => data,
  )
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
 */
export const studentUpdateBatchFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; defaultBatch: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; session?: StudentSession; error?: string }> => {
      const { serverStudentUpdateBatch } = await import("./student.server.ts");
      return serverStudentUpdateBatch(data.email, data.defaultBatch);
    },
  );
