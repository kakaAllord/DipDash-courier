import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCourierById } from "@/lib/repo/couriers";
import { CourierNav } from "@/components/courier/CourierNav";
import { Wordmark } from "@/components/Brand";
import { Badge } from "@/components/ui/Badge";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession("courier");
  if (!session) redirect("/activate");
  const courier = await getCourierById(session.sub);
  if (!courier) redirect("/activate");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={26} height={26} className="rounded-lg" />
            <Wordmark />
            <span className="rounded bg-primary-dark px-1.5 py-0.5 text-[10px] font-bold text-white">
              COURIER
            </span>
          </Link>
          <Badge tone={courier.isOnline ? "primary" : "neutral"}>
            {courier.isOnline ? "● Online" : "Offline"}
          </Badge>
        </div>
      </header>
      <div className="flex-1 px-4 py-4 pb-6">{children}</div>
      <CourierNav />
    </div>
  );
}
