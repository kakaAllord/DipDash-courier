import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { Order, OrderItem } from "@/lib/db/schema";
import { isAutoOpen } from "@/lib/domain/delivery";

/** A courier's cash-out requests, newest first. */
export async function listPayouts(courierId: string) {
  return db
    .select()
    .from(schema.payouts)
    .where(eq(schema.payouts.courierId, courierId))
    .orderBy(desc(schema.payouts.requestedAt));
}

export async function getCourierById(courierId: string) {
  const rows = await db
    .select()
    .from(schema.couriers)
    .where(eq(schema.couriers.id, courierId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Look up a courier by the student's admission number. Couriers sign in with
 * their admission number + the same password they set in the student app, so
 * we return the student's password hash for verification.
 */
export async function findCourierByAdmission(admissionNo: string) {
  const rows = await db
    .select({
      courier: schema.couriers,
      studentName: schema.students.name,
      passwordHash: schema.students.passwordHash,
    })
    .from(schema.couriers)
    .innerJoin(schema.students, eq(schema.couriers.studentId, schema.students.id))
    .where(eq(schema.students.admissionNo, admissionNo.trim()))
    .limit(1);
  return rows[0] ?? null;
}

export interface CourierOrderView extends Order {
  items: OrderItem[];
  vendorName: string;
  vendorLocation: string;
  vendorLat: number | null;
  vendorLng: number | null;
  studentName: string;
  studentPhone: string | null;
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
    vendorLat: vById.get(o.vendorId)?.lat ?? null,
    vendorLng: vById.get(o.vendorId)?.lng ?? null,
    studentName: sById.get(o.studentId)?.name ?? "Student",
    studentPhone: sById.get(o.studentId)?.phone ?? null,
  }));
}

/**
 * Orders a courier can grab: instant requests (finding_courier) plus scheduled
 * orders that have auto-opened (within 40 min of their delivery time and still
 * unassigned by the admin). Excludes scheduled orders still awaiting dispatch.
 */
export async function listOpenOrders() {
  const rows = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        isNull(schema.orders.courierId),
        inArray(schema.orders.status, ["finding_courier", "scheduled"])
      )
    )
    .orderBy(desc(schema.orders.t0PlacedAt));
  const now = Date.now();
  const open = rows.filter(
    (o) => o.status === "finding_courier" || isAutoOpen(o.deliverAt, now)
  );
  return hydrate(open);
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
