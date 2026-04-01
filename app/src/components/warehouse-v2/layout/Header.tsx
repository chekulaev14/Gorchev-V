'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/warehouse-v2/items', label: 'Номенклатура' },
  { href: '/warehouse-v2/stock', label: 'Остатки' },
  { href: '/warehouse-v2/production', label: 'Производство' },
];

interface Props {
  breadcrumb?: string;
}

export function Header({ breadcrumb }: Props) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card px-6">
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Склад</span>
          {breadcrumb && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground">{breadcrumb}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-1 -mb-px">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                isActive
                  ? 'border-foreground text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
