import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCourierById } from "@/lib/repo/couriers";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { tsh } from "@/lib/format";
import { orderCeiling, hotMealsUnlocked, RISK } from "@/lib/domain/risk";
import { DepositLoader } from "@/components/courier/DepositLoader";

export default async function WalletPage() {
  const session = await getSession("courier");
  if (!session) redirect("/activate");
  const courier = await getCourierById(session.sub);
  if (!courier) redirect("/activate");

  const unlocked = hotMealsUnlocked(courier.depositTsh);
  const progress = Math.min(
    100,
    Math.round((courier.depositTsh / RISK.hotMealsThresholdTsh) * 100)
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Wallet</h1>

      <Card className="bg-primary-dark text-white">
        <p className="text-xs uppercase tracking-wide text-white/70">
          Security deposit
        </p>
        <p className="text-4xl font-extrabold">{tsh(courier.depositTsh)}</p>
        <p className="mt-1 text-sm text-white/80">
          Order ceiling {tsh(orderCeiling(courier.depositTsh))} (80% rule)
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Earnings</p>
          <p className="text-xl font-extrabold text-primary">
            {tsh(courier.earningsTsh)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">
            Locked (to deposit)
          </p>
          <p className="text-xl font-extrabold">{tsh(courier.lockedWalletTsh)}</p>
        </Card>
      </div>

      {/* Hot-meals tier progress */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-bold">Hot meals tier</p>
          <Badge tone={unlocked ? "primary" : "neutral"}>
            {unlocked ? "Unlocked" : "Locked"}
          </Badge>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {unlocked
            ? "You can carry hot meals (chips, pilau, wali, mixer)."
            : `Reach ${tsh(
                RISK.hotMealsThresholdTsh
              )} deposit to unlock hot meals. A portion of each payout is auto-saved here.`}
        </p>
      </Card>

      <Card>
        <DepositLoader />
      </Card>
    </div>
  );
}
