import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  getCourierById,
  listOpenOrders,
  listCourierOrders,
} from "@/lib/repo/couriers";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { tsh, clock } from "@/lib/format";
import { canAcceptOrder, orderCeiling, courierEarning } from "@/lib/domain/risk";
import { isHotMeal, type MenuCategory } from "@/lib/domain/catalog";
import { distanceBetween, formatDistance, CAMPUS_CENTER } from "@/lib/domain/geo";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  type OrderStatus,
} from "@/lib/domain/lifecycle";
import { OnlineToggle } from "@/components/courier/OnlineToggle";
import { AcceptButton } from "@/components/courier/AcceptButton";
import { FeedLive } from "@/components/courier/FeedLive";

export default async function FeedPage() {
  const session = await getSession("courier");
  if (!session) redirect("/activate");
  const courier = await getCourierById(session.sub);
  if (!courier) redirect("/activate");

  const [openRaw, mine] = await Promise.all([
    listOpenOrders(),
    listCourierOrders(courier.id),
  ]);
  const active = mine.filter(
    (o) =>
      o.status === "pending_payment" ||
      o.status === "accepted" ||
      o.status === "collected"
  );

  // Prefer nearby pickups: sort open orders by distance from the courier's
  // last-known location (falling back to campus) to each vendor. A courier can
  // hold several deliveries at once, so closer jobs surface first.
  const from =
    courier.lastLat != null && courier.lastLng != null
      ? { lat: courier.lastLat, lng: courier.lastLng }
      : CAMPUS_CENTER;
  const open = openRaw
    .map((o) => ({
      o,
      dist: distanceBetween(from, { lat: o.vendorLat, lng: o.vendorLng }),
    }))
    .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

  return (
    <div className="flex flex-col gap-5">
      <FeedLive courierId={courier.id} />
      {/* Status header */}
      <Card className="bg-primary-dark text-white">
        <p className="text-xs uppercase tracking-wide text-white/70">
          Security deposit
        </p>
        <p className="text-3xl font-extrabold">{tsh(courier.depositTsh)}</p>
        <p className="mt-1 text-sm text-white/80">
          Order ceiling {tsh(orderCeiling(courier.depositTsh))} · 90% rule
        </p>
      </Card>

      <OnlineToggle online={courier.isOnline} courierId={courier.id} />

      {/* Active deliveries */}
      {active.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            Your active deliveries
          </h2>
          {active.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <Card className="flex items-center gap-3 transition-colors hover:border-primary">
                <div className="flex-1">
                  <p className="font-bold">{o.vendorName}</p>
                  <p className="text-sm text-muted">{o.deliverTo ?? "—"}</p>
                </div>
                <Badge tone={ORDER_STATUS_TONE[o.status as OrderStatus]}>
                  {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                </Badge>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {/* Available orders */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Available orders
        </h2>
        {open.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            No orders waiting right now. Stay online — they&apos;ll appear here.
          </p>
        )}
        {open.map(({ o, dist }) => {
          const hasHotMeal = o.items.some((i) =>
            isHotMeal(i.category as MenuCategory)
          );
          const check = canAcceptOrder({
            depositTsh: courier.depositTsh,
            itemCostTsh: o.itemCostTsh,
            hasHotMeal,
          });
          return (
            <Card key={o.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{o.vendorName}</p>
                    <Badge tone={o.vendorLocation === "in_campus" ? "primary" : "accent"}>
                      {o.vendorLocation === "in_campus" ? "In campus" : "Off campus"}
                    </Badge>
                    {dist != null && (
                      <Badge tone="neutral">{formatDistance(dist)} away</Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted">
                    {o.items.map((i) => `${i.qty}× ${i.nameSnapshot}`).join(", ")}
                  </p>
                  <p className="text-xs text-muted">
                    To {o.deliverTo ?? "—"} · placed {o.t0PlacedAt ? clock(o.t0PlacedAt) : "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-extrabold text-primary">
                    +{tsh(courierEarning(o.deliveryFeeTsh))}
                  </p>
                  <p className="text-xs text-muted">you earn</p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                {hasHotMeal && <Badge tone="accent">Hot meal</Badge>}
                {check.ok ? (
                  <div className="ml-auto">
                    <AcceptButton orderId={o.id} courierId={courier.id} />
                  </div>
                ) : (
                  <span className="ml-auto text-right text-xs font-medium text-danger">
                    🔒 {check.reason}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
