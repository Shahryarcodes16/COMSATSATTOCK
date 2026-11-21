/**
 * TanStack Start Server Functions for Coordinator Authentication
 * Safe RPC boundary callable from client components with Zod validation.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CoordinatorAuthResponse } from "./coordinator.server";

const CoordinatorRequestCodeSchema = z.object({
  email: z.string().email().min(5).max(120),
  fullName: z.string().min(2).max(100),
  department: z.string().optional(),
  designation: z.string().optional(),
  originUrl: z.string().url().optional(),
});

const CoordinatorVerifySchema = z.object({
  email: z.string().email().min(5).max(120),
  code: z.string().length(6),
  password: z.string().min(6).max(128),
  department: z.string().optional(),
  designation: z.string().optional(),
});

const CoordinatorSignInSchema = z.object({
  email: z.string().email().min(5).max(120),
  password: z.string().min(1).max(128),
  clientVaultAccount: z
    .object({
      id: z.string().optional(),
      email: z.string(),
      fullName: z.string(),
      department: z.string().optional(),
      designation: z.string().optional(),
      passwordHash: z.string(),
      passwordSalt: z.string(),
      registeredAt: z.string().optional(),
    })
    .optional(),
});

/**
 * Server Function: Request Coordinator Email Verification Code
 */
export const coordinatorRequestVerificationCodeFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => CoordinatorRequestCodeSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean;
      message?: string;
      error?: string;
    }> => {
      const { serverRequestCoordinatorVerificationCode } = await import("./coordinator.server.ts");
      return serverRequestCoordinatorVerificationCode(
        data.email,
        data.fullName,
        data.department,
        data.designation,
        data.originUrl,
      );
    },
  );

/**
 * Server Function: Verify 6-Digit Code and Create Coordinator Account
 */
export const coordinatorVerifyAndSignUpFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => CoordinatorVerifySchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<CoordinatorAuthResponse> => {
      const { serverVerifyCoordinatorCodeAndSignUp } = await import("./coordinator.server.ts");
      return serverVerifyCoordinatorCodeAndSignUp(
        data.email,
        data.code,
        data.password,
        data.department,
        data.designation,
      );
    },
  );

/**
 * Server Function: Coordinator Sign In
 */
export const coordinatorSignInFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => CoordinatorSignInSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<CoordinatorAuthResponse> => {
      const { serverCoordinatorSignIn } = await import("./coordinator.server.ts");
      return serverCoordinatorSignIn(data.email, data.password, data.clientVaultAccount as any);
    },
  );
