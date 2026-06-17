import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getCourierById, getCourierOrder } from "@/lib/repo/couriers";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { OrderTimeline } from "@/components/OrderTimeline";
import { OrderLive } from "@/components/OrderLive";
import { OrderActions } from "@/components/courier/OrderActions";
import { tsh } from "@/lib/format";
import { courierEarning } from "@/lib/domain/risk";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  type OrderStatus,
} from "@/lib/domain/lifecycle";

export default async function CourierOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession("courier");
  if (!session) redirect("/activate");
  const courier = await getCourierById(session.sub);
  if (!courier) redirect("/activate");

  const { id } = await params;
  const order = await getCourierOrder(id);
  if (!order || order.courierId !== courier.id) notFound();

  const status = order.status as OrderStatus;
  const earned = courierEarning(order.deliveryFeeTsh);

  return (
    <div className="flex flex-col gap-4">
      <OrderLive orderId={order.id} role="courier" soundEvent="order_update" />
      <Link href="/" className="text-sm font-medium text-primary">
        ← Feed
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{order.vendorName}</h1>
          <p className="text-sm text-muted">For {order.studentName}</p>
        </div>
        <Badge tone={ORDER_STATUS_TONE[status]}>
          {ORDER_STATUS_LABEL[status]}
        </Badge>
      </div>

      <OrderActions
        orderId={order.id}
        status={status}
        pickupToken={order.pickupToken}
        courierId={courier.id}
      />

      <Card className="flex flex-col gap-2">
        <h2 className="font-bold">Deliver to</h2>
        <p className="text-sm">{order.deliverTo ?? "No note provided"}</p>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <p className="text-sm text-muted">
            {order.studentName}
          </p>
          {order.studentPhone && (
            <a
              href={`tel:${order.studentPhone}`}
              aria-label={`Call ${order.studentName}`}
              title={`Call ${order.studentName}`}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-border/60 text-green-600 transition-transform active:scale-95"
            >
              <PhoneIcon />
            </a>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="font-bold">Items</h2>
        {order.items.map((i) => (
          <div key={i.id} className="flex justify-between text-sm">
            <span>
              {i.qty}× {i.nameSnapshot}
            </span>
            <span className="font-medium">{tsh(i.qty * i.unitPriceTsh)}</span>
          </div>
        ))}
      </Card>

      <Card className="flex items-center justify-between">
        <h2 className="font-bold">{status === "delivered" ? "You earned" : "You'll earn"}</h2>
        <span className="text-xl font-extrabold text-primary">{tsh(earned)}</span>
      </Card>

      <Card>
        <h2 className="mb-3 font-bold">Timeline</h2>
        <OrderTimeline
          t0PlacedAt={order.t0PlacedAt}
          t1AcceptedAt={order.t1AcceptedAt}
          t2CollectedAt={order.t2CollectedAt}
          t3DeliveredAt={order.t3DeliveredAt}
        />
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}
