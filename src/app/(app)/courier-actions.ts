"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db/client";
import { getSession, clearSession } from "@/lib/auth/session";
import { getCourierById } from "@/lib/repo/couriers";
import { id } from "@/lib/ids";
import { canAcceptOrder, canGoActive, courierEarning, RISK } from "@/lib/domain/risk";
import { isHotMeal, type MenuCategory } from "@/lib/domain/catalog";
import { isAutoOpen } from "@/lib/domain/delivery";

export interface Result {
  ok: boolean;
  error?: string;
}

async function requireCourier() {
  const session = await getSession("courier");
  if (!session) return null;
  return getCourierById(session.sub);
}

export async function logoutCourier() {
  await clearSession("courier");
  redirect("/activate");
}

/** Simulated mobile-money top-up of the security deposit. */
export async function loadDeposit(amountTsh: number): Promise<Result> {
  const courier = await requireCourier();
  if (!courier) return { ok: false, error: "Please activate again" };
  if (!Number.isFinite(amountTsh) || amountTsh <= 0) {
    return { ok: false, error: "Invalid amount" };
  }
  const newDeposit = courier.depositTsh + Math.round(amountTsh);
  const patch: Partial<typeof schema.couriers.$inferInsert> = {
    depositTsh: newDeposit,
  };
  // Topping back over the minimum lifts a restriction.
  if (courier.status === "restricted" && canGoActive(newDeposit)) {
    patch.status = "active";
  }
  await db.update(schema.couriers).set(patch).where(eq(schema.couriers.id, courier.id));
  revalidatePath("/wallet");
  revalidatePath("/");
  return { ok: true };
}

/** Move all spendable earnings into the security deposit (lifts the ceiling). */
export async function moveEarningsToDeposit(): Promise<Result> {
  const courier = await requireCourier();
  if (!courier) return { ok: false, error: "Please activate again" };
  if (courier.earningsTsh <= 0) return { ok: false, error: "No earnings to move" };

  const amount = courier.earningsTsh;
  const newDeposit = courier.depositTsh + amount;
  const patch: Partial<typeof schema.couriers.$inferInsert> = {
    depositTsh: newDeposit,
    earningsTsh: 0,
  };
  if (courier.status === "restricted" && canGoActive(newDeposit)) {
    patch.status = "active";
  }
  await db.update(schema.couriers).set(patch).where(eq(schema.couriers.id, courier.id));
  revalidatePath("/wallet");
  revalidatePath("/");
  return { ok: true };
}

/** Request a cash-out of all earnings (allowed from the payout threshold). */
export async function requestPayout(): Promise<Result> {
  const courier = await requireCourier();
  if (!courier) return { ok: false, error: "Please activate again" };
  if (courier.earningsTsh < RISK.payoutThresholdTsh) {
    return {
      ok: false,
      error: `You can withdraw once earnings reach ${RISK.payoutThresholdTsh.toLocaleString(
        "en-US"
      )} TSh`,
    };
  }
  const amount = courier.earningsTsh;
  await db.transaction(async (tx) => {
    await tx.insert(schema.payouts).values({
      id: id("pay"),
      courierId: courier.id,
      amountTsh: amount,
      status: "requested",
    });
    await tx
      .update(schema.couriers)
      .set({ earningsTsh: 0 })
      .where(eq(schema.couriers.id, courier.id));
  });
  revalidatePath("/wallet");
  return { ok: true };
}

export async function setOnline(online: boolean): Promise<Result> {
  const courier = await requireCourier();
  if (!courier) return { ok: false, error: "Please activate again" };
  if (online && !canGoActive(courier.depositTsh)) {
    return { ok: false, error: "Load at least 2,000 TSh deposit to go online" };
  }
  if (online && courier.status === "restricted") {
    return { ok: false, error: "Account restricted — top up your deposit first" };
  }
  await db
    .update(schema.couriers)
    .set({ isOnline: online })
    .where(eq(schema.couriers.id, courier.id));
  revalidatePath("/");
  revalidatePath("/wallet");
  return { ok: true };
}

/** Persist last-known live location (throttled by the client streamer). */
export async function updateLocation(lat: number, lng: number): Promise<Result> {
  const courier = await requireCourier();
  if (!courier) return { ok: false, error: "Not signed in" };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "Invalid coordinates" };
  }
  await db
    .update(schema.couriers)
    .set({ lastLat: lat, lastLng: lng, lastLocationAt: Date.now() })
    .where(eq(schema.couriers.id, courier.id));
  return { ok: true };
}

export async function acceptOrder(orderId: string): Promise<Result> {
  const courier = await requireCourier();
  if (!courier) return { ok: false, error: "Please activate again" };
  if (!courier.isOnline) return { ok: false, error: "Go online first" };

  const orderRows = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), isNull(schema.orders.courierId)))
    .limit(1);
  const order = orderRows[0];
  if (!order) return { ok: false, error: "Order is no longer available" };

  const isInstant = order.status === "finding_courier";
  const isScheduledOpen =
    order.status === "scheduled" && isAutoOpen(order.deliverAt);
  if (!isInstant && !isScheduledOpen) {
    return { ok: false, error: "Order is no longer available" };
  }

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));
  const hasHotMeal = items.some((i) => isHotMeal(i.category as MenuCategory));

  const check = canAcceptOrder({
    depositTsh: courier.depositTsh,
    itemCostTsh: order.itemCostTsh,
    hasHotMeal,
  });
  if (!check.ok) return { ok: false, error: check.reason };

  // Instant: hold at pending_payment until the student pays. Scheduled (already
  // paid): go straight to accepted. Guarded update avoids double-accept races.
  const nextStatus = isInstant ? "pending_payment" : "accepted";
  const claimed = await db
    .update(schema.orders)
    .set({ courierId: courier.id, status: nextStatus, t1AcceptedAt: Date.now() })
    .where(and(eq(schema.orders.id, orderId), isNull(schema.orders.courierId)))
    .returning({ id: schema.orders.id });
  if (claimed.length === 0) {
    return { ok: false, error: "Another courier just grabbed it" };
  }

  revalidatePath("/");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function markCollected(orderId: string): Promise<Result> {
  const courier = await requireCourier();
  if (!courier) return { ok: false, error: "Please activate again" };

  const rows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  const order = rows[0];
  if (!order || order.courierId !== courier.id || order.status !== "accepted") {
    return { ok: false, error: "Can't collect this order" };
  }
  await db
    .update(schema.orders)
    .set({ status: "collected", t2CollectedAt: Date.now() })
    .where(eq(schema.orders.id, orderId));
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Handoff: student's PIN releases escrow and pays the courier (with withholding). */
export async function confirmDelivery(
  orderId: string,
  pin: string
): Promise<Result> {
  const courier = await requireCourier();
  if (!courier) return { ok: false, error: "Please activate again" };

  const rows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  const order = rows[0];
  if (!order || order.courierId !== courier.id || order.status !== "collected") {
    return { ok: false, error: "Can't complete this order" };
  }
  if (order.confirmationPin !== pin.trim()) {
    return { ok: false, error: "Incorrect PIN" };
  }

  // Courier keeps 50% of the delivery fee as spendable earnings.
  const earned = courierEarning(order.deliveryFeeTsh);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.orders)
      .set({ status: "delivered", t3DeliveredAt: Date.now() })
      .where(eq(schema.orders.id, orderId));
    await tx
      .update(schema.escrowTxns)
      .set({ state: "released", note: "Released to courier on PIN handoff" })
      .where(eq(schema.escrowTxns.orderId, orderId));
    await tx
      .update(schema.couriers)
      .set({ earningsTsh: courier.earningsTsh + earned })
      .where(eq(schema.couriers.id, courier.id));
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/");
  revalidatePath("/wallet");
  return { ok: true };
}
