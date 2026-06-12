# Dipdash Courier

The courier app for the [Dipdash](../README.md) platform. Approved student
couriers activate here, manage their security deposit, accept risk‑filtered
orders, and complete deliveries.

- **Next.js 16 · React 19 · Tailwind v4 · Drizzle · PostgreSQL**
- Runs on **http://localhost:3001**
- Shares the central `dipdash` Postgres DB (see `.env` → `DATABASE_URL`).

## Run

```powershell
npm install
npm run dev      # http://localhost:3001
```

The database is created/seeded from the **student** app (`dipdash`). This app
only reads/writes the shared tables.

## Flow

1. **Activate** — phone + 6‑char token (issued by an admin on approval).
2. **Wallet** — top up the security deposit (simulated mobile money). Minimum
   2,000 TSh to go online; hot meals unlock at 10,000 TSh.
3. **Feed** — see orders within your 80%‑of‑deposit ceiling; accept one (T1).
4. **Deliver** — show the pickup token at the counter → "Collected" (T2) →
   enter the student's PIN at handoff (T3) → escrow releases and you're paid
   (a slice is auto‑withheld toward your deposit until it reaches 10,000 TSh).

## Domain rules

The ordering/risk/escrow logic lives in `src/lib/domain` and is a verbatim copy
of the same modules in the other two repos — keep them in sync.
