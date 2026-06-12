import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getCourierById, getCourierOrder } from "@/lib/repo/couriers";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { OrderTimeline } from "@/components/OrderTimeline";
import { OrderActions } from "@/components/courier/OrderActions";
import { tsh } from "@/lib/format";
import { computePayoutSplit } from "@/lib/domain/risk";
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
  const split = computePayoutSplit(courier.depositTsh, order.deliveryFeeTsh);

  return (
    <div className="flex flex-col gap-4">
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
      />

      <Card>
        <h2 className="mb-2 font-bold">Deliver to</h2>
        <p className="text-sm">{order.deliverTo ?? "No note provided"}</p>
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

      <Card className="flex flex-col gap-1.5">
        <h2 className="font-bold">Your payout</h2>
        <Row label="Delivery fee" value={tsh(order.deliveryFeeTsh)} />
        {split.withheldTsh > 0 && (
          <Row
            label="Withheld to deposit (scaling)"
            value={`-${tsh(split.withheldTsh)}`}
          />
        )}
        <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
          <span>{status === "delivered" ? "Paid out" : "You'll earn"}</span>
          <span className="text-primary">{tsh(split.toEarningsTsh)}</span>
        </div>
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
