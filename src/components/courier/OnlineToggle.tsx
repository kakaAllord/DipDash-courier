"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setOnline } from "@/app/(app)/courier-actions";
import { getSocket, joinRoom, emitPresence } from "@/lib/realtime";

export function OnlineToggle({
  online,
  courierId,
}: {
  online: boolean;
  courierId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Announce current presence to the relay on mount so the admin board is
  // accurate even after a reload.
  useEffect(() => {
    const s = getSocket({ role: "courier", id: courierId });
    joinRoom(s, "couriers");
    if (online) emitPresence(s, { courierId, online: true });
  }, [online, courierId]);

  function toggle() {
    setError(null);
    start(async () => {
      const res = await setOnline(!online);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      emitPresence(getSocket({ role: "courier", id: courierId }), {
        courierId,
        online: !online,
      });
      router.refresh();
    });
  }

  return (
    <div>
      <Button
        block
        size="lg"
        variant={online ? "secondary" : "primary"}
        onClick={toggle}
        disabled={pending}
      >
        {pending ? "…" : online ? "Go offline" : "Go online to receive orders"}
      </Button>
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
