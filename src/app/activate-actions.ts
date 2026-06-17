"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { findCourierByAdmission } from "@/lib/repo/couriers";
import { createSession } from "@/lib/auth/session";

const schemaIn = z.object({
  admissionNo: z.string().trim().min(1, "Enter your admission number"),
  password: z.string().min(1, "Enter your password"),
});

export interface LoginResult {
  ok: boolean;
  error?: string;
}

/**
 * Courier sign-in: admission number + the password set in the student app.
 * The courier profile must have been approved by an admin.
 */
export async function loginCourier(
  _prev: LoginResult | null,
  formData: FormData
): Promise<LoginResult> {
  const parsed = schemaIn.safeParse({
    admissionNo: formData.get("admissionNo"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const match = await findCourierByAdmission(parsed.data.admissionNo);
  if (!match || !match.passwordHash) {
    return { ok: false, error: "No approved courier found for that admission number" };
  }
  if (!bcrypt.compareSync(parsed.data.password, match.passwordHash)) {
    return { ok: false, error: "Incorrect password" };
  }
  if (match.courier.status === "pending") {
    return { ok: false, error: "Your application is still pending approval" };
  }
  if (match.courier.status === "restricted") {
    return { ok: false, error: "Account restricted — contact an admin" };
  }

  // First sign-in after approval flips the profile to active.
  if (match.courier.status !== "active") {
    await db
      .update(schema.couriers)
      .set({ status: "active", activatedAt: Date.now() })
      .where(eq(schema.couriers.id, match.courier.id));
  }

  await createSession({
    kind: "courier",
    sub: match.courier.id,
    name: match.studentName,
  });
  return { ok: true };
}
