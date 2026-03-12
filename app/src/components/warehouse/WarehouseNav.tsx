"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWarehouse } from "./WarehouseContext";

const baseItems = [
  { href: "/warehouse/nomenclature", label: "Номенклатура" },
  { href: "/warehouse/operations", label: "Операции" },
];

export function WarehouseNav() {
  const pathname = usePathname();
  const { session, editMode } = useWarehouse();

  let navItems = [...baseItems];
  if (editMode) {
    navItems.push({ href: "/warehouse/bom", label: "Состав" });
    navItems.push({ href: "/warehouse/routing", label: "Маршруты" });
  }
  if (session?.role === "DIRECTOR") {
    navItems.push({ href: "/warehouse/production", label: "Выработка" });
  }

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
