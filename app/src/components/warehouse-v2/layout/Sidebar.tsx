'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const modules = [
  { href: '/', label: 'Дашборд', icon: '📊' },
  { href: '/warehouse-v2', label: 'Склад', icon: '📦' },
  { href: '/documents', label: 'Документы', icon: '📄' },
  { href: '/terminal', label: 'Терминал', icon: '🏭' },
  { href: '/warehouse', label: 'Склад (v1)', icon: '📋' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-border">
        <span className="text-foreground font-semibold text-sm">ERP</span>
      </div>
      <nav className="flex-1 py-2">
        {modules.map((mod) => {
          const isActive =
            mod.href === '/'
              ? pathname === '/'
              : pathname.startsWith(mod.href) &&
                (mod.href !== '/warehouse' || !pathname.startsWith('/warehouse-v2'));
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <span>{mod.icon}</span>
              {mod.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
