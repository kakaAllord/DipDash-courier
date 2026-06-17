"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { acceptOrder } from "@/app/(app)/courier-actions";
import { getSocket, emitOrderStatus } from "@/lib/realtime";

export function AcceptButton({
  orderId,
  courierId,
}: {
  orderId: string;
  courierId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    start(async () => {
      const res = await acceptOrder(orderId);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      emitOrderStatus(getSocket({ role: "courier", id: courierId }), {
        orderId,
        status: "accepted",
      });
      router.push(`/orders/${orderId}`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={accept} disabled={pending}>
        {pending ? "…" : "Accept"}
      </Button>
      {error && <p className="text-right text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
