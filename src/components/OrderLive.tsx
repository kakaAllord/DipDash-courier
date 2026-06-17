"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSocket, joinRoom } from "@/lib/realtime";
import { playForEvent } from "@/lib/sound";

/**
 * Keeps an order detail page live: any status change (paid, accepted, collected,
 * delivered…) refreshes the view over sockets — no manual reload needed.
 * Pass `soundEvent` to chime on updates.
 */
export function OrderLive({
  orderId,
  role,
  soundEvent,
}: {
  orderId: string;
  role: string;
  soundEvent?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const s = getSocket({ role, id: role });
    joinRoom(s, `order:${orderId}`);
    const onStatus = () => {
      if (soundEvent) playForEvent(soundEvent);
      router.refresh();
    };
    s.on("order_status", onStatus);
    return () => {
      s.off("order_status", onStatus);
    };
  }, [orderId, role, soundEvent, router]);
  return null;
}
