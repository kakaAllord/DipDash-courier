"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { tsh } from "@/lib/format";
import { loadDeposit } from "@/app/(app)/courier-actions";

const AMOUNTS = [2000, 5000, 10000];

export function DepositLoader() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function load(amount: number) {
    setError(null);
    start(async () => {
      const res = await loadDeposit(amount);
      if (!res.ok) setError(res.error ?? "Failed");
      else router.refresh();
    });
  }

  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        Top up your security deposit (simulated mobile money):
      </p>
      <div className="grid grid-cols-3 gap-2">
        {AMOUNTS.map((a) => (
          <Button
            key={a}
            variant="secondary"
            disabled={pending}
            onClick={() => load(a)}
          >
            +{tsh(a)}
          </Button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
