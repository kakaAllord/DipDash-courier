"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { findCourierForActivation } from "@/lib/repo/couriers";
import { createSession } from "@/lib/auth/session";

const schemaIn = z.object({
  phone: z.string().trim().min(6, "Enter your phone number"),
  token: z.string().trim().min(4, "Enter your activation token"),
});

export interface ActivateResult {
  ok: boolean;
  error?: string;
}

export async function activateCourier(
  _prev: ActivateResult | null,
  formData: FormData
): Promise<ActivateResult> {
  const parsed = schemaIn.safeParse({
    phone: formData.get("phone"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const match = await findCourierForActivation(
    parsed.data.phone,
    parsed.data.token.toUpperCase()
  );
  if (!match) {
    return { ok: false, error: "Phone or token doesn't match an approved courier" };
  }
  if (match.courier.status === "pending") {
    return { ok: false, error: "Your application is still pending approval" };
  }
  if (match.courier.status === "restricted") {
    return { ok: false, error: "Account restricted — contact an admin" };
  }

  await db
    .update(schema.couriers)
    .set({ status: "active", activatedAt: Date.now() })
    .where(eq(schema.couriers.id, match.courier.id));

  await createSession({
    kind: "courier",
    sub: match.courier.id,
    name: match.studentName,
  });
  return { ok: true };
}
