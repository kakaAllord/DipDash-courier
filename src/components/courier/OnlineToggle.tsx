"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setOnline } from "@/app/(app)/courier-actions";

export function OnlineToggle({ online }: { online: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    start(async () => {
      const res = await setOnline(!online);
      if (!res.ok) setError(res.error ?? "Failed");
      else router.refresh();
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
