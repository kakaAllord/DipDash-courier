"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { markCollected, confirmDelivery } from "@/app/(app)/courier-actions";
import { getSocket, emitOrderStatus } from "@/lib/realtime";

export function OrderActions({
  orderId,
  status,
  pickupToken,
  courierId,
}: {
  orderId: string;
  status: string;
  pickupToken: string;
  courierId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  function collect() {
    setError(null);
    start(async () => {
      const res = await markCollected(orderId);
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        emitOrderStatus(getSocket({ role: "courier", id: courierId }), {
          orderId,
          status: "collected",
        });
        router.refresh();
      }
    });
  }

  function deliver() {
    setError(null);
    start(async () => {
      const res = await confirmDelivery(orderId, pin);
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        emitOrderStatus(getSocket({ role: "courier", id: courierId }), {
          orderId,
          status: "delivered",
        });
        router.refresh();
      }
    });
  }

  if (status === "pending_payment") {
    return (
      <Card className="border-accent/40 bg-accent-soft/30 text-center">
        <p className="text-sm font-medium">
          ⏳ Waiting for the student to pay. You&apos;ll get the pickup token here
          the moment they do.
        </p>
      </Card>
    );
  }

  if (status === "accepted") {
    return (
      <Card className="flex flex-col gap-3 border-primary bg-primary-soft/40">
        <div className="text-center">
          <p className="text-sm font-medium text-primary-dark">
            Show this pickup token at the counter
          </p>
          <p className="font-mono text-3xl font-extrabold tracking-[0.2em] text-primary-dark">
            {pickupToken}
          </p>
        </div>
        <Button block size="lg" onClick={collect} disabled={pending}>
          {pending ? "…" : "I've collected the order"}
        </Button>
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
      </Card>
    );
  }

  if (status === "collected") {
    return (
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-medium">
          At handoff, ask the student for their 4-digit PIN.
        </p>
        <Input
          label="Confirmation PIN"
          inputMode="numeric"
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <Button block size="lg" onClick={deliver} disabled={pending || pin.length < 4}>
          {pending ? "Confirming…" : "Confirm delivery & get paid"}
        </Button>
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
      </Card>
    );
  }

  return null;
}
