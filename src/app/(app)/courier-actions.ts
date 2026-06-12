"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db/client";
import { getSession, clearSession } from "@/lib/auth/session";
import { getCourierById } from "@/lib/repo/couriers";
import { canAcceptOrder, canGoActive, computePayoutSplit } from "@/lib/domain/risk";
import { isHotMeal, type MenuCategory } from "@/lib/domain/catalog";

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
  if (!order || order.status !== "paid") {
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

  // Guarded update: only claim if still unassigned (avoids double-accept races).
  const claimed = await db
    .update(schema.orders)
    .set({ courierId: courier.id, status: "accepted", t1AcceptedAt: Date.now() })
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

  const split = computePayoutSplit(courier.depositTsh, order.deliveryFeeTsh);

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
      .set({
        depositTsh: split.newDepositTsh,
        lockedWalletTsh: courier.lockedWalletTsh + split.withheldTsh,
        earningsTsh: courier.earningsTsh + split.toEarningsTsh,
      })
      .where(eq(schema.couriers.id, courier.id));
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/");
  revalidatePath("/wallet");
  return { ok: true };
}
