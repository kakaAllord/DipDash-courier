"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginCourier, type LoginResult } from "../activate-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordField } from "@/components/ui/PasswordField";
import { Logo, Wordmark } from "@/components/Brand";

export default function CourierLoginPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState<LoginResult | null, FormData>(
    loginCourier,
    null
  );

  useEffect(() => {
    if (state?.ok) router.replace("/");
  }, [state, router]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo size={56} />
        <div className="flex items-center gap-1.5">
          <Wordmark className="text-2xl" />
          <span className="rounded-md bg-primary-dark px-2 py-0.5 text-xs font-bold text-white">
            COURIER
          </span>
        </div>
        <p className="text-sm text-muted">
          Sign in with your admission number and password.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <Input
          name="admissionNo"
          label="Admission number"
          placeholder="29030111002"
          autoComplete="username"
          required
        />
        <PasswordField
          name="password"
          label="Password"
          placeholder="Your account password"
          autoComplete="current-password"
          required
        />
        {state?.error && (
          <p className="text-sm font-medium text-danger">{state.error}</p>
        )}
        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        Not approved yet? Apply in the Dipdash student app, then wait for an
        admin to approve you.
      </p>
    </main>
  );
}
