/**
 * TanStack Start Server Functions for Student Authentication
 * Safe RPC boundary callable from client components.
 */
import { createServerFn } from "@tanstack/react-start";
import type { StudentSession } from "./student";

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
    }): Promise<{ success: boolean; session?: StudentSession; error?: string }> => {
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
    }): Promise<{ success: boolean; session?: StudentSession; error?: string }> => {
      const { serverStudentSignIn } = await import("./student.server.ts");
      return serverStudentSignIn(data.email, data.password);
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
