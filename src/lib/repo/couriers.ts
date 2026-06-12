import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { Order, OrderItem } from "@/lib/db/schema";

export async function getCourierById(courierId: string) {
  const rows = await db
    .select()
    .from(schema.couriers)
    .where(eq(schema.couriers.id, courierId))
    .limit(1);
  return rows[0] ?? null;
}

/** Match a courier for activation by their phone (via student) + token. */
export async function findCourierForActivation(phone: string, token: string) {
  const rows = await db
    .select({
      courier: schema.couriers,
      studentName: schema.students.name,
    })
    .from(schema.couriers)
    .innerJoin(schema.students, eq(schema.couriers.studentId, schema.students.id))
    .where(
      and(
        eq(schema.students.phone, phone.trim()),
        eq(schema.couriers.activationToken, token.trim())
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export interface CourierOrderView extends Order {
  items: OrderItem[];
  vendorName: string;
  vendorLocation: string;
  studentName: string;
  deliverTo: string | null;
}

async function hydrate(orders: Order[]): Promise<CourierOrderView[]> {
  if (orders.length === 0) return [];
  const [allItems, vendors, students] = await Promise.all([
    db.select().from(schema.orderItems),
    db.select().from(schema.vendors),
    db.select().from(schema.students),
  ]);
  const vById = new Map(vendors.map((v) => [v.id, v]));
  const sById = new Map(students.map((s) => [s.id, s]));
  return orders.map((o) => ({
    ...o,
    items: allItems.filter((i) => i.orderId === o.id),
    vendorName: vById.get(o.vendorId)?.name ?? "Unknown",
    vendorLocation: vById.get(o.vendorId)?.location ?? "in_campus",
    studentName: sById.get(o.studentId)?.name ?? "Student",
  }));
}

/** Orders paid and awaiting a courier. */
export async function listOpenOrders() {
  const rows = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.status, "paid"), isNull(schema.orders.courierId)))
    .orderBy(desc(schema.orders.t0PlacedAt));
  return hydrate(rows);
}

/** Orders this courier is currently handling or has completed. */
export async function listCourierOrders(courierId: string) {
  const rows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.courierId, courierId))
    .orderBy(desc(schema.orders.createdAt));
  return hydrate(rows);
}

export async function getCourierOrder(orderId: string) {
  const rows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  if (!rows[0]) return null;
  return (await hydrate(rows))[0];
}
