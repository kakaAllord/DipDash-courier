"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { tsh } from "@/lib/format";
import { moveEarningsToDeposit, requestPayout } from "@/app/(app)/courier-actions";

/**
 * Cash-out controls. Adding earnings to the deposit is promoted first (it lifts
 * the order ceiling / unlocks hot meals); withdrawing is the fallback and opens
 * at the payout threshold.
 */
export function WalletActions({
  earningsTsh,
  threshold,
}: {
  earningsTsh: number;
  threshold: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canWithdraw = earningsTsh >= threshold;

  function addToDeposit() {
    setError(null);
    start(async () => {
      const res = await moveEarningsToDeposit();
      if (!res.ok) setError(res.error ?? "Failed");
      else router.refresh();
    });
  }

  function withdraw() {
    setError(null);
    start(async () => {
      const res = await requestPayout();
      if (!res.ok) setError(res.error ?? "Failed");
      else router.refresh();
    });
  }

  if (earningsTsh <= 0) {
    return (
      <p className="text-sm text-muted">
        Deliver orders to earn — you keep 50% of every delivery fee.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-primary/40 bg-primary-soft/40 p-3">
        <p className="text-sm font-bold text-primary-dark">
          💡 Grow your deposit, carry bigger orders
        </p>
        <p className="mb-2 text-xs text-muted">
          Move your {tsh(earningsTsh)} earnings into your security deposit to raise
          your order ceiling (and unlock hot meals at 10,000 TSh).
        </p>
        <Button block onClick={addToDeposit} disabled={pending}>
          {pending ? "…" : `Add ${tsh(earningsTsh)} to deposit`}
        </Button>
      </div>

      <div>
        <Button
          variant="secondary"
          block
          onClick={withdraw}
          disabled={pending || !canWithdraw}
        >
          {canWithdraw
            ? `Withdraw ${tsh(earningsTsh)}`
            : `Withdraw (from ${tsh(threshold)})`}
        </Button>
        <p className="mt-1 text-center text-xs text-muted">
          {canWithdraw
            ? "Paid to your mobile money within 12 hours."
            : `Reach ${tsh(threshold)} in earnings to cash out.`}
        </p>
      </div>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
