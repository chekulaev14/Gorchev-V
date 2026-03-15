'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWarehouse } from './WarehouseContext';

const baseItems = [
  { href: '/warehouse/nomenclature', label: 'Номенклатура' },
  { href: '/warehouse/operations', label: 'Операции' },
];

export function WarehouseNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, editMode } = useWarehouse();

  const navItems = [...baseItems];
  if (editMode) {
    // navItems.push({ href: "/warehouse/bom", label: "Состав" }); // скрыто — пока используются только маршруты
    navItems.push({ href: '/warehouse/routing', label: 'Маршруты' });
    navItems.push({ href: '/warehouse/setup', label: 'Массовая загрузка' });
  }
  if (session?.role === 'DIRECTOR' || session?.role === 'ADMIN') {
    navItems.push({ href: '/warehouse/production', label: 'Выработка' });
  }

  return (
    <div className="flex gap-1 overflow-x-auto -mx-4 px-4 scrollbar-hide">
      {navItems.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={(e) => {
              if (active) {
                e.preventDefault();
                window.location.href = href;
              }
            }}
            className={`text-sm px-3 py-2 rounded-md transition-colors whitespace-nowrap ${
              active
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
