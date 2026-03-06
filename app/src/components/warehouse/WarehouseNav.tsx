"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWarehouse } from "./WarehouseContext";

const baseItems = [
  { href: "/warehouse/nomenclature", label: "Номенклатура" },
  { href: "/warehouse/stock", label: "Остатки" },
  { href: "/warehouse/assembly", label: "Сборка" },
  { href: "/warehouse/operations", label: "Операции" },
];

export function WarehouseNav() {
  const pathname = usePathname();
  const { session } = useWarehouse();

  const navItems = session?.role === "director"
    ? [...baseItems, { href: "/warehouse/production", label: "Выработка" }]
    : baseItems;

  return (
    <div className="flex gap-1 overflow-x-auto -mx-4 px-4 scrollbar-hide">
      {navItems.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm px-3 py-2 rounded-md transition-colors whitespace-nowrap ${
              active
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
