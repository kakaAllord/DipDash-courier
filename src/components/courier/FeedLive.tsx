"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSocket, joinRoom } from "@/lib/realtime";
import { playForEvent } from "@/lib/sound";

/**
 * Keeps the courier feed fresh: refreshes when a new order needs a courier
 * (instant request or a scheduled order that just auto-opened).
 */
export function FeedLive({ courierId }: { courierId: string }) {
  const router = useRouter();
  useEffect(() => {
    const s = getSocket({ role: "courier", id: courierId });
    joinRoom(s, "couriers");
    // Refresh both when a new order appears AND when any order changes hands, so
    // an order another courier just grabbed disappears from this feed instantly.
    const refresh = () => router.refresh();
    const onNew = () => {
      playForEvent("new_order");
      router.refresh();
    };
    s.on("new_order", onNew);
    s.on("order_status", refresh);
    return () => {
      s.off("new_order", onNew);
      s.off("order_status", refresh);
    };
  }, [courierId, router]);
  return null;
}
