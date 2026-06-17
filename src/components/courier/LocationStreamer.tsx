"use client";

import { useEffect, useRef } from "react";
import { getSocket, joinRoom, emitLocation } from "@/lib/realtime";
import { updateLocation } from "@/app/(app)/courier-actions";

/**
 * Headless: while the courier is online, stream their device location to the
 * realtime relay (so admins can track them live) and persist it periodically
 * as a fallback. There is no map on the courier side by design.
 */
export function LocationStreamer({
  courierId,
  online,
}: {
  courierId: string;
  online: boolean;
}) {
  const lastPersist = useRef(0);

  useEffect(() => {
    if (!online || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    const s = getSocket({ role: "courier", id: courierId });
    joinRoom(s, "couriers");

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        emitLocation(s, { courierId, lat, lng });
        const now = Date.now();
        if (now - lastPersist.current > 15_000) {
          lastPersist.current = now;
          updateLocation(lat, lng).catch(() => {});
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [online, courierId]);

  return null;
}
