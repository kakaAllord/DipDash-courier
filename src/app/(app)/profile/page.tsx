import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCourierById } from "@/lib/repo/couriers";
import { getStudentById } from "@/lib/repo/students";
import { listCourierOrders } from "@/lib/repo/couriers";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { tsh } from "@/lib/format";
import { RingtoneSettings } from "@/components/RingtoneSettings";
import { logoutCourier } from "../courier-actions";

export default async function CourierProfile() {
  const session = await getSession("courier");
  if (!session) redirect("/activate");
  const courier = await getCourierById(session.sub);
  if (!courier) redirect("/activate");
  const student = await getStudentById(courier.studentId);
  const orders = await listCourierOrders(courier.id);
  const delivered = orders.filter((o) => o.status === "delivered").length;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Profile</h1>

      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white">
            {student?.name
              ? student.name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n.charAt(0))
                  .join("")
                  .toUpperCase()
              : "C"}
          </div>
          <div>
            <p className="font-bold">{student?.name ?? "Courier"}</p>
            <p className="text-sm text-muted">{courier.course}</p>
            <p className="text-sm text-muted">{student?.phone}</p>
          </div>
          <Badge
            tone={courier.status === "restricted" ? "danger" : "primary"}
            className="ml-auto"
          >
            {courier.status}
          </Badge>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Delivered</p>
          <p className="text-2xl font-extrabold">{delivered}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Earnings</p>
          <p className="text-2xl font-extrabold text-primary">
            {tsh(courier.earningsTsh)}
          </p>
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <p className="font-bold">Sounds</p>
        <RingtoneSettings
          events={[
            { id: "new_order", label: "New order available" },
            { id: "order_update", label: "Order updates" },
          ]}
        />
      </Card>

      <form action={logoutCourier}>
        <Button type="submit" variant="ghost" block>
          Sign out
        </Button>
      </form>
    </div>
  );
}
