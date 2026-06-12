"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const items = [
  { href: "/", label: "Feed", icon: "📦", match: (p: string) => p === "/" || p.startsWith("/orders") },
  { href: "/wallet", label: "Wallet", icon: "💰", match: (p: string) => p.startsWith("/wallet") },
  { href: "/profile", label: "Profile", icon: "👤", match: (p: string) => p.startsWith("/profile") },
];

export function CourierNav() {
  const pathname = usePathname();
  return (
    <nav className="safe-bottom sticky bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5">
        {items.map((it) => {
          const active = it.match(pathname);
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted"
                )}
              >
                <span className="text-lg leading-none">{it.icon}</span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
