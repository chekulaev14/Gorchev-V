# Warehouse UI 2.0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенос модуля Склад на object-centric UI 2.0 по /warehouse-v2 с master-detail slide-over, минимальным shell и тремя табами.

**Architecture:** Новый UI живёт по /warehouse-v2, старый /warehouse не трогаем. Компоненты в warehouse-v2/. Используем существующие API без изменений. Shared-компоненты (SlideOverPanel, FilterBar, DataList) переиспользуемы для будущих модулей.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, существующие API endpoints.

**Spec:** `docs/superpowers/specs/2026-04-01-warehouse-ui-2.0-design.md`

---

## Chunk 1: Shell и роутинг

### Task 1: Next.js роутинг для /warehouse-v2

**Files:**
- Create: `app/src/app/warehouse-v2/layout.tsx`
- Create: `app/src/app/warehouse-v2/page.tsx`
- Create: `app/src/app/warehouse-v2/items/page.tsx`
- Create: `app/src/app/warehouse-v2/stock/page.tsx`
- Create: `app/src/app/warehouse-v2/production/page.tsx`

- [ ] **Step 1: Создать layout с минимальной оболочкой**

```tsx
// app/src/app/warehouse-v2/layout.tsx
import { WarehouseV2Shell } from "@/components/warehouse-v2/layout/Shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <WarehouseV2Shell>{children}</WarehouseV2Shell>;
}
```

- [ ] **Step 2: Создать redirect с /warehouse-v2 на /warehouse-v2/items**

```tsx
// app/src/app/warehouse-v2/page.tsx
import { redirect } from "next/navigation";
export default function Page() {
  redirect("/warehouse-v2/items");
}
```

- [ ] **Step 3: Создать страницы-заглушки для трёх табов**

```tsx
// app/src/app/warehouse-v2/items/page.tsx
export default function ItemsPage() {
  return <div>Номенклатура — загрузка...</div>;
}

// app/src/app/warehouse-v2/stock/page.tsx
export default function StockPage() {
  return <div>Остатки — загрузка...</div>;
}

// app/src/app/warehouse-v2/production/page.tsx
export default function ProductionPage() {
  return <div>Производство — загрузка...</div>;
}
```

- [ ] **Step 4: Проверить что /warehouse-v2 открывается и редиректит на /items**

Run: открыть http://localhost:3000/warehouse-v2
Expected: редирект на /warehouse-v2/items, отображается заглушка

- [ ] **Step 5: Commit**

```bash
git add app/src/app/warehouse-v2/
git commit -m "feat(warehouse-v2): scaffold routing — layout, redirect, tab pages"
```

### Task 2: Shell — Sidebar + Header

**Files:**
- Create: `app/src/components/warehouse-v2/layout/Shell.tsx`
- Create: `app/src/components/warehouse-v2/layout/Sidebar.tsx`
- Create: `app/src/components/warehouse-v2/layout/Header.tsx`

- [ ] **Step 1: Создать Sidebar**

```tsx
// app/src/components/warehouse-v2/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const modules = [
  { href: "/warehouse-v2", label: "Склад", icon: "📦", active: true },
  { href: "/warehouse", label: "Склад (v1)", icon: "📋", active: true },
  { href: "/terminal", label: "Терминал", icon: "🏭", active: true },
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
          const isActive = pathname.startsWith(mod.href) && 
            (mod.href !== "/warehouse" || !pathname.startsWith("/warehouse-v2"));
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
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
```

- [ ] **Step 2: Создать Header с breadcrumb и табами**

```tsx
// app/src/components/warehouse-v2/layout/Header.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/warehouse-v2/items", label: "Номенклатура" },
  { href: "/warehouse-v2/stock", label: "Остатки" },
  { href: "/warehouse-v2/production", label: "Производство" },
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
                  ? "border-foreground text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
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
```

- [ ] **Step 3: Создать Shell, собрать Sidebar + Header + content**

```tsx
// app/src/components/warehouse-v2/layout/Shell.tsx
"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function WarehouseV2Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Проверить shell в браузере**

Run: http://localhost:3000/warehouse-v2
Expected: sidebar слева, header с табами сверху, контент справа. Табы кликабельны, подсвечивается активный.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/warehouse-v2/layout/
git commit -m "feat(warehouse-v2): minimal shell — sidebar, header with tabs, breadcrumb"
```

---

## Chunk 2: Shared-компоненты

### Task 3: SlideOverPanel

**Files:**
- Create: `app/src/components/warehouse-v2/shared/SlideOverPanel.tsx`

- [ ] **Step 1: Создать SlideOverPanel**

```tsx
// app/src/components/warehouse-v2/shared/SlideOverPanel.tsx
"use client";

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function SlideOverPanel({ open, onClose, title, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onClose]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (open) {
      // Delay to avoid immediate close from the click that opened it
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="w-[40%] min-w-[400px] max-w-[560px] shrink-0 border-l border-border bg-card overflow-y-auto h-full"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
        <h2 className="text-foreground text-sm font-semibold truncate">{title}</h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg leading-none"
        >
          ×
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/warehouse-v2/shared/SlideOverPanel.tsx
git commit -m "feat(warehouse-v2): SlideOverPanel shared component"
```

### Task 4: FilterBar

**Files:**
- Create: `app/src/components/warehouse-v2/shared/FilterBar.tsx`

- [ ] **Step 1: Создать FilterBar с debounced search**

```tsx
// app/src/components/warehouse-v2/shared/FilterBar.tsx
"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  allLabel?: string;
}

interface DateRange {
  from: string;
  to: string;
}

interface Props {
  filters?: FilterConfig[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

export function FilterBar({
  filters,
  filterValues,
  onFilterChange,
  searchPlaceholder = "Поиск...",
  searchValue,
  onSearchChange,
  dateRange,
  onDateRangeChange,
}: Props) {
  const [localSearch, setLocalSearch] = useState(searchValue);

  useEffect(() => {
    const timer = setTimeout(() => onSearchChange(localSearch), 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-3">
      <Input
        placeholder={searchPlaceholder}
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
        className="bg-background border-border text-foreground text-sm h-9 w-full sm:max-w-xs"
      />
      {filters?.map((filter) => (
        <select
          key={filter.key}
          value={filterValues?.[filter.key] ?? ""}
          onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
          className="h-9 px-3 text-sm rounded-md border border-border bg-background text-foreground"
        >
          <option value="">{filter.allLabel ?? `Все ${filter.label}`}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
      {dateRange && onDateRangeChange && (
        <>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
            className="h-9 px-2 text-sm rounded-md border border-border bg-background text-foreground"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
            className="h-9 px-2 text-sm rounded-md border border-border bg-background text-foreground"
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/warehouse-v2/shared/FilterBar.tsx
git commit -m "feat(warehouse-v2): FilterBar shared component with debounced search"
```

### Task 5: DataList

**Files:**
- Create: `app/src/components/warehouse-v2/shared/DataList.tsx`

- [ ] **Step 1: Создать DataList**

```tsx
// app/src/components/warehouse-v2/shared/DataList.tsx
"use client";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right";
  render: (item: T) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  getKey: (item: T) => string;
  activeId?: string | null;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function DataList<T>({
  columns,
  data,
  getKey,
  activeId,
  onRowClick,
  emptyMessage = "Нет данных",
}: Props<T>) {
  if (data.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-6 py-2 text-xs font-medium text-muted-foreground ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const key = getKey(item);
            const isActive = activeId === key;
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-border/50 transition-colors ${
                  onRowClick ? "cursor-pointer hover:bg-accent/50" : ""
                } ${isActive ? "bg-accent" : ""}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-6 py-2.5 text-sm ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/warehouse-v2/shared/DataList.tsx
git commit -m "feat(warehouse-v2): DataList shared component"
```

---

## Chunk 3: Таб Номенклатура

### Task 6: NomenclatureTab + ItemPanel

**Files:**
- Create: `app/src/components/warehouse-v2/tabs/NomenclatureTab.tsx`
- Create: `app/src/components/warehouse-v2/panels/ItemPanel.tsx`
- Create: `app/src/components/warehouse-v2/shared/RoutingPreview.tsx`
- Modify: `app/src/app/warehouse-v2/items/page.tsx`

- [ ] **Step 1: Создать RoutingPreview — read-only визуализация цепочки**

```tsx
// app/src/components/warehouse-v2/shared/RoutingPreview.tsx
"use client";

interface RoutingInput {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
}

interface RoutingStep {
  stepNo: number;
  outputItemName: string;
  outputQty: number;
  outputUnit: string;
  inputs: RoutingInput[];
}

interface Props {
  steps: RoutingStep[];
}

export function RoutingPreview({ steps }: Props) {
  if (steps.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">Маршрут не задан</p>
    );
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {steps.map((step, idx) => (
        <div key={step.stepNo} className="flex items-center gap-1 shrink-0">
          {step.inputs.length > 0 && (
            <>
              <div className="flex flex-col gap-0.5">
                {step.inputs.map((inp) => (
                  <div
                    key={inp.itemId}
                    className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800"
                  >
                    {inp.itemName}
                    <span className="text-amber-500 ml-1">
                      {inp.quantity} {inp.unit}
                    </span>
                  </div>
                ))}
              </div>
              <span className="text-muted-foreground text-xs">→</span>
            </>
          )}
          {step.inputs.length === 0 && idx > 0 && (
            <span className="text-muted-foreground text-xs">→</span>
          )}
          <div className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-xs text-blue-800">
            {step.outputItemName}
            <span className="text-blue-500 ml-1">
              ×{step.outputQty}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Создать ItemPanel — карточка позиции**

```tsx
// app/src/components/warehouse-v2/panels/ItemPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { SlideOverPanel } from "../shared/SlideOverPanel";
import { RoutingPreview } from "../shared/RoutingPreview";
import { api } from "@/lib/api-client";
import { itemTypeLabels, unitLabels, typeColors, formatNumber } from "@/lib/constants";
import type { NomenclatureItem, StockMovement } from "@/lib/types";

interface RoutingData {
  id: string;
  name: string;
  status: string;
  steps: Array<{
    stepNo: number;
    outputItem: { name: string; unit: string };
    outputQty: number;
    inputs: Array<{
      item: { id: string; name: string; unit: string };
      quantity: number;
    }>;
  }>;
}

interface Props {
  item: NomenclatureItem | null;
  balance: number;
  onClose: () => void;
}

export function ItemPanel({ item, balance, onClose }: Props) {
  const [routing, setRouting] = useState<RoutingData | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    setRouting(null);
    setMovements([]);

    Promise.all([
      api
        .get<{ routings: RoutingData[] }>(`/api/routing?itemId=${item.id}`, { silent: true })
        .then((d) => {
          const active = d.routings?.find((r) => r.status === "ACTIVE");
          setRouting(active ?? null);
        })
        .catch(() => {}),
      api
        .get<{ movements: StockMovement[] }>(`/api/stock?itemId=${item.id}`, { silent: true })
        .then((d) => setMovements(d.movements?.slice(0, 20) ?? []))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [item]);

  if (!item) return null;

  const routingSteps = routing?.steps.map((s) => ({
    stepNo: s.stepNo,
    outputItemName: s.outputItem.name,
    outputQty: Number(s.outputQty),
    outputUnit: unitLabels[s.outputItem.unit as keyof typeof unitLabels] ?? s.outputItem.unit,
    inputs: s.inputs.map((inp) => ({
      itemId: inp.item.id,
      itemName: inp.item.name,
      quantity: Number(inp.quantity),
      unit: unitLabels[inp.item.unit as keyof typeof unitLabels] ?? inp.item.unit,
    })),
  })) ?? [];

  const movementTypeLabels: Record<string, string> = {
    SUPPLIER_INCOME: "Приход",
    PRODUCTION_INCOME: "Производство",
    ASSEMBLY_WRITE_OFF: "Списание",
    ASSEMBLY_INCOME: "Производство",
    ADJUSTMENT_INCOME: "Корректировка +",
    ADJUSTMENT_WRITE_OFF: "Корректировка −",
    SHIPMENT_WRITE_OFF: "Отгрузка",
  };

  return (
    <SlideOverPanel open={!!item} onClose={onClose} title={item.name}>
      {loading ? (
        <p className="text-muted-foreground text-sm">Загрузка...</p>
      ) : (
        <div className="space-y-5">
          {/* Основные данные */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${typeColors[item.type]}`}>
                {itemTypeLabels[item.type]}
              </Badge>
              {item.side && item.side !== "NONE" && (
                <Badge variant="outline" className="text-xs">
                  {item.side === "LEFT" ? "Л" : "П"}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Код:</span>{" "}
                <span className="text-foreground">{item.code}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ед.:</span>{" "}
                <span className="text-foreground">{unitLabels[item.unit]}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Остаток:</span>{" "}
                <span className="text-foreground font-mono">
                  {formatNumber(balance)} {unitLabels[item.unit]}
                </span>
              </div>
              {item.pricePerUnit != null && (
                <div>
                  <span className="text-muted-foreground">Тариф:</span>{" "}
                  <span className="text-foreground">{item.pricePerUnit} ₽</span>
                </div>
              )}
            </div>
          </section>

          {/* Маршрут */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">Маршрут</h3>
              {routing && (
                <a
                  href={`/warehouse/routing?itemId=${item.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Редактировать
                </a>
              )}
            </div>
            <RoutingPreview steps={routingSteps} />
          </section>

          {/* История движений */}
          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
              Последние движения
            </h3>
            {movements.length === 0 ? (
              <p className="text-muted-foreground text-xs">Нет движений</p>
            ) : (
              <div className="space-y-1">
                {movements.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-xs py-1 border-b border-border/30"
                  >
                    <span className="text-muted-foreground">
                      {new Date(m.date).toLocaleDateString("ru-RU")}
                    </span>
                    <span className="text-foreground">
                      {movementTypeLabels[m.type] ?? m.type}
                    </span>
                    <span className="font-mono text-foreground">
                      {formatNumber(m.quantity)} {unitLabels[item.unit]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </SlideOverPanel>
  );
}
```

- [ ] **Step 3: Создать NomenclatureTab**

```tsx
// app/src/components/warehouse-v2/tabs/NomenclatureTab.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { FilterBar } from "../shared/FilterBar";
import { DataList } from "../shared/DataList";
import { ItemPanel } from "../panels/ItemPanel";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { itemTypeLabels, unitLabels, typeColors, formatNumber } from "@/lib/constants";
import type { NomenclatureItem } from "@/lib/types";

const typeFilterOptions = [
  { value: "material", label: "Сырьё" },
  { value: "blank", label: "Заготовки" },
  { value: "product", label: "Изделия" },
];

export function NomenclatureTab() {
  const [items, setItems] = useState<NomenclatureItem[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedItem, setSelectedItem] = useState<NomenclatureItem | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [nomData, stockData] = await Promise.all([
        api.get<{ items: NomenclatureItem[] }>("/api/nomenclature", { silent: true }),
        api.get<{ balances: Record<string, number> }>("/api/stock", { silent: true }),
      ]);
      setItems(nomData.items);
      setBalances(stockData.balances);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    let result = items;
    if (typeFilter) {
      result = result.filter((i) => i.type === typeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, search, typeFilter]);

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Наименование",
        render: (item: NomenclatureItem) => (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs shrink-0 ${typeColors[item.type]}`}>
              {itemTypeLabels[item.type]}
            </Badge>
            <span className="text-foreground">{item.name}</span>
          </div>
        ),
      },
      {
        key: "code",
        header: "Код",
        width: "120px",
        render: (item: NomenclatureItem) => (
          <span className="text-muted-foreground">{item.code}</span>
        ),
      },
      {
        key: "balance",
        header: "Остаток",
        width: "120px",
        align: "right" as const,
        render: (item: NomenclatureItem) => (
          <span className="font-mono text-foreground">
            {formatNumber(balances[item.id] ?? 0)} {unitLabels[item.unit]}
          </span>
        ),
      },
    ],
    [balances],
  );

  if (loading) {
    return <div className="px-6 py-12 text-center text-muted-foreground text-sm">Загрузка...</div>;
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Поиск по названию, коду..."
          filters={[
            { key: "type", label: "тип", options: typeFilterOptions },
          ]}
          filterValues={{ type: typeFilter }}
          onFilterChange={(key, value) => {
            if (key === "type") setTypeFilter(value);
          }}
        />
        <div className="flex-1 overflow-auto">
          <DataList
            columns={columns}
            data={filtered}
            getKey={(item) => item.id}
            activeId={selectedItem?.id}
            onRowClick={(item) => setSelectedItem(item)}
            emptyMessage="Нет позиций"
          />
        </div>
      </div>
      <ItemPanel
        item={selectedItem}
        balance={selectedItem ? (balances[selectedItem.id] ?? 0) : 0}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Подключить NomenclatureTab к странице**

```tsx
// app/src/app/warehouse-v2/items/page.tsx
import { NomenclatureTab } from "@/components/warehouse-v2/tabs/NomenclatureTab";

export default function ItemsPage() {
  return <NomenclatureTab />;
}
```

- [ ] **Step 5: Проверить в браузере**

Run: http://localhost:3000/warehouse-v2/items
Expected: таблица номенклатуры с фильтрами, при клике на строку — slide-over справа с карточкой позиции.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/warehouse-v2/tabs/NomenclatureTab.tsx \
       app/src/components/warehouse-v2/panels/ItemPanel.tsx \
       app/src/components/warehouse-v2/shared/RoutingPreview.tsx \
       app/src/app/warehouse-v2/items/page.tsx
git commit -m "feat(warehouse-v2): NomenclatureTab with ItemPanel and RoutingPreview"
```

---

## Chunk 4: Таб Остатки

### Task 7: StockTab + StockItemPanel

**Files:**
- Create: `app/src/components/warehouse-v2/tabs/StockTab.tsx`
- Create: `app/src/components/warehouse-v2/panels/StockItemPanel.tsx`
- Modify: `app/src/app/warehouse-v2/stock/page.tsx`

- [ ] **Step 1: Создать StockItemPanel — история движений + actions**

```tsx
// app/src/components/warehouse-v2/panels/StockItemPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlideOverPanel } from "../shared/SlideOverPanel";
import { api } from "@/lib/api-client";
import { unitLabels, formatNumber } from "@/lib/constants";
import type { NomenclatureItem, StockMovement } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  item: NomenclatureItem | null;
  balance: number;
  onClose: () => void;
  onRefresh: () => void;
}

type ActionMode = null | "income" | "shipment" | "adjustment";

export function StockItemPanel({ item, balance, onClose, onRefresh }: Props) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    setActionMode(null);
    setQuantity("");
    api
      .get<{ movements: StockMovement[] }>(`/api/stock?itemId=${item.id}`, { silent: true })
      .then((d) => setMovements(d.movements?.slice(0, 30) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [item]);

  if (!item) return null;

  const movementTypeLabels: Record<string, string> = {
    SUPPLIER_INCOME: "Приход",
    PRODUCTION_INCOME: "Производство",
    ASSEMBLY_WRITE_OFF: "Списание",
    ASSEMBLY_INCOME: "Производство",
    ADJUSTMENT_INCOME: "Корректировка +",
    ADJUSTMENT_WRITE_OFF: "Корректировка −",
    SHIPMENT_WRITE_OFF: "Отгрузка",
  };

  const handleAction = async () => {
    if (!actionMode || !quantity || Number(quantity) <= 0) return;
    const actionMap = {
      income: "SUPPLIER_INCOME",
      shipment: "SHIPMENT",
      adjustment: "ADJUSTMENT",
    } as const;

    setSubmitting(true);
    try {
      await api.post("/api/stock", {
        action: actionMap[actionMode],
        itemId: item.id,
        quantity: Number(quantity),
      });
      toast.success(
        actionMode === "income" ? "Оприходовано" :
        actionMode === "shipment" ? "Отгружено" : "Скорректировано"
      );
      setActionMode(null);
      setQuantity("");
      onRefresh();
    } catch {
      // handled by api-client
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideOverPanel open={!!item} onClose={onClose} title={item.name}>
      {loading ? (
        <p className="text-muted-foreground text-sm">Загрузка...</p>
      ) : (
        <div className="space-y-5">
          <div className="text-center py-3 bg-accent/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Остаток</p>
            <p className="text-2xl font-mono text-foreground">
              {formatNumber(balance)} {unitLabels[item.unit]}
            </p>
          </div>

          {/* Actions */}
          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Действия</h3>
            {!actionMode ? (
              <div className="flex gap-2">
                {item.type === "material" && (
                  <Button size="sm" variant="outline" onClick={() => setActionMode("income")}>
                    Приход
                  </Button>
                )}
                {item.type === "product" && (
                  <Button size="sm" variant="outline" onClick={() => setActionMode("shipment")}>
                    Отгрузка
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setActionMode("adjustment")}>
                  Корректировка
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.01"
                  step={item.unit === "kg" ? "0.1" : "1"}
                  placeholder="Кол-во"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-9 w-24 text-sm"
                  autoFocus
                />
                <Button size="sm" onClick={handleAction} disabled={submitting || !quantity}>
                  {submitting ? "..." : "OK"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setActionMode(null); setQuantity(""); }}>
                  Отмена
                </Button>
              </div>
            )}
          </section>

          {/* Movements */}
          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
              История движений
            </h3>
            {movements.length === 0 ? (
              <p className="text-muted-foreground text-xs">Нет движений</p>
            ) : (
              <div className="space-y-1">
                {movements.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-xs py-1 border-b border-border/30"
                  >
                    <span className="text-muted-foreground">
                      {new Date(m.date).toLocaleDateString("ru-RU")}
                    </span>
                    <span className="text-foreground">
                      {movementTypeLabels[m.type] ?? m.type}
                    </span>
                    <span className="font-mono text-foreground">
                      {formatNumber(m.quantity)} {unitLabels[item.unit]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </SlideOverPanel>
  );
}
```

- [ ] **Step 2: Создать StockTab**

```tsx
// app/src/components/warehouse-v2/tabs/StockTab.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { FilterBar } from "../shared/FilterBar";
import { DataList } from "../shared/DataList";
import { StockItemPanel } from "../panels/StockItemPanel";
import { api } from "@/lib/api-client";
import { itemTypeLabels, unitLabels, typeColors, formatNumber } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import type { NomenclatureItem } from "@/lib/types";

const typeFilterOptions = [
  { value: "material", label: "Сырьё" },
  { value: "blank", label: "Заготовки" },
  { value: "product", label: "Изделия" },
];

export function StockTab() {
  const [items, setItems] = useState<NomenclatureItem[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedItem, setSelectedItem] = useState<NomenclatureItem | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [nomData, stockData] = await Promise.all([
        api.get<{ items: NomenclatureItem[] }>("/api/nomenclature", { silent: true }),
        api.get<{ balances: Record<string, number> }>("/api/stock", { silent: true }),
      ]);
      setItems(nomData.items);
      setBalances(stockData.balances);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    let result = items.filter((i) => (balances[i.id] ?? 0) !== 0 || i.type !== "blank");
    if (typeFilter) {
      result = result.filter((i) => i.type === typeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    return result;
  }, [items, balances, search, typeFilter]);

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Позиция",
        render: (item: NomenclatureItem) => (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs shrink-0 ${typeColors[item.type]}`}>
              {itemTypeLabels[item.type]}
            </Badge>
            <span className="text-foreground">{item.name}</span>
          </div>
        ),
      },
      {
        key: "balance",
        header: "Остаток",
        width: "140px",
        align: "right" as const,
        render: (item: NomenclatureItem) => {
          const bal = balances[item.id] ?? 0;
          return (
            <span className={`font-mono ${bal === 0 ? "text-destructive" : "text-foreground"}`}>
              {formatNumber(bal)} {unitLabels[item.unit]}
            </span>
          );
        },
      },
    ],
    [balances],
  );

  if (loading) {
    return <div className="px-6 py-12 text-center text-muted-foreground text-sm">Загрузка...</div>;
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Поиск по названию..."
          filters={[
            { key: "type", label: "тип", options: typeFilterOptions },
          ]}
          filterValues={{ type: typeFilter }}
          onFilterChange={(key, value) => {
            if (key === "type") setTypeFilter(value);
          }}
        />
        <div className="flex-1 overflow-auto">
          <DataList
            columns={columns}
            data={filtered}
            getKey={(item) => item.id}
            activeId={selectedItem?.id}
            onRowClick={(item) => setSelectedItem(item)}
            emptyMessage="Нет позиций с остатками"
          />
        </div>
      </div>
      <StockItemPanel
        item={selectedItem}
        balance={selectedItem ? (balances[selectedItem.id] ?? 0) : 0}
        onClose={() => setSelectedItem(null)}
        onRefresh={() => { fetchData(); setSelectedItem(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Подключить StockTab к странице**

```tsx
// app/src/app/warehouse-v2/stock/page.tsx
import { StockTab } from "@/components/warehouse-v2/tabs/StockTab";

export default function StockPage() {
  return <StockTab />;
}
```

- [ ] **Step 4: Проверить в браузере**

Run: http://localhost:3000/warehouse-v2/stock
Expected: список позиций с остатками, при клике — slide-over с историей движений и action-кнопками.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/warehouse-v2/tabs/StockTab.tsx \
       app/src/components/warehouse-v2/panels/StockItemPanel.tsx \
       app/src/app/warehouse-v2/stock/page.tsx
git commit -m "feat(warehouse-v2): StockTab with StockItemPanel and stock actions"
```

---

## Chunk 5: Таб Производство + финализация

### Task 8: ProductionTab + OperationPanel

**Files:**
- Create: `app/src/components/warehouse-v2/tabs/ProductionTab.tsx`
- Create: `app/src/components/warehouse-v2/panels/OperationPanel.tsx`
- Modify: `app/src/app/warehouse-v2/production/page.tsx`

- [ ] **Step 1: Создать OperationPanel**

```tsx
// app/src/components/warehouse-v2/panels/OperationPanel.tsx
"use client";

import { SlideOverPanel } from "../shared/SlideOverPanel";
import { formatNumber } from "@/lib/constants";

interface WorkerEntry {
  workerId: string;
  workerName: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
}

export interface ProductionLogEntry {
  id: string;
  workerId: string;
  workerName: string;
  itemName: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
  createdAt: string;
}

interface Props {
  entry: ProductionLogEntry | null;
  allEntries: ProductionLogEntry[];
  onClose: () => void;
}

export function OperationPanel({ entry, allEntries, onClose }: Props) {
  if (!entry) return null;

  // Group by same item + same timestamp (same operation, multiple workers)
  const operationWorkers: WorkerEntry[] = allEntries
    .filter(
      (e) =>
        e.itemName === entry.itemName &&
        e.createdAt === entry.createdAt,
    )
    .map((e) => ({
      workerId: e.workerId,
      workerName: e.workerName,
      quantity: e.quantity,
      pricePerUnit: e.pricePerUnit,
      total: e.total,
    }));

  const totalQty = operationWorkers.reduce((sum, w) => sum + w.quantity, 0);
  const totalPay = operationWorkers.reduce((sum, w) => sum + w.total, 0);

  return (
    <SlideOverPanel open={!!entry} onClose={onClose} title={entry.itemName}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Дата:</span>{" "}
            <span className="text-foreground">
              {new Date(entry.createdAt).toLocaleString("ru-RU")}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Всего:</span>{" "}
            <span className="text-foreground font-mono">{formatNumber(totalQty)} шт</span>
          </div>
        </div>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Рабочие</h3>
          <div className="space-y-2">
            {operationWorkers.map((w) => (
              <div
                key={w.workerId}
                className="flex items-center justify-between p-2 rounded bg-accent/30 text-sm"
              >
                <span className="text-foreground font-medium">{w.workerName}</span>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-foreground">
                    {formatNumber(w.quantity)} шт
                  </span>
                  <span className="text-muted-foreground">
                    × {w.pricePerUnit} ₽
                  </span>
                  <span className="font-mono text-emerald-600 font-medium">
                    {formatNumber(w.total)} ₽
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-between items-center pt-2 border-t border-border text-sm">
          <span className="text-muted-foreground">Итого начислено:</span>
          <span className="font-mono text-emerald-600 font-semibold text-base">
            {formatNumber(totalPay)} ₽
          </span>
        </div>
      </div>
    </SlideOverPanel>
  );
}
```

- [ ] **Step 2: Создать ProductionTab**

```tsx
// app/src/components/warehouse-v2/tabs/ProductionTab.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { FilterBar } from "../shared/FilterBar";
import { DataList } from "../shared/DataList";
import { OperationPanel, type ProductionLogEntry } from "../panels/OperationPanel";
import { api } from "@/lib/api-client";
import { formatNumber } from "@/lib/constants";

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export function ProductionTab() {
  const [logs, setLogs] = useState<ProductionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [selectedEntry, setSelectedEntry] = useState<ProductionLogEntry | null>(null);

  const days = useMemo(() => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
  }, [dateRange]);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.get<{ logs: ProductionLogEntry[] }>(
        `/api/terminal/logs?days=${days}`,
        { silent: true },
      );
      // Filter by date range on client (API only supports days param)
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to + "T23:59:59");
      setLogs(
        data.logs.filter((l) => {
          const d = new Date(l.createdAt);
          return d >= fromDate && d <= toDate;
        }),
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [days, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.workerName.toLowerCase().includes(q) ||
        l.itemName.toLowerCase().includes(q),
    );
  }, [logs, search]);

  const columns = useMemo(
    () => [
      {
        key: "date",
        header: "Дата",
        width: "130px",
        render: (entry: ProductionLogEntry) => (
          <span className="text-muted-foreground">
            {new Date(entry.createdAt).toLocaleDateString("ru-RU")}
          </span>
        ),
      },
      {
        key: "worker",
        header: "Рабочий",
        width: "160px",
        render: (entry: ProductionLogEntry) => (
          <span className="text-foreground">{entry.workerName}</span>
        ),
      },
      {
        key: "item",
        header: "Позиция",
        render: (entry: ProductionLogEntry) => (
          <span className="text-foreground">{entry.itemName}</span>
        ),
      },
      {
        key: "quantity",
        header: "Кол-во",
        width: "80px",
        align: "right" as const,
        render: (entry: ProductionLogEntry) => (
          <span className="font-mono text-foreground">{formatNumber(entry.quantity)}</span>
        ),
      },
      {
        key: "total",
        header: "Начислено",
        width: "100px",
        align: "right" as const,
        render: (entry: ProductionLogEntry) => (
          <span className="font-mono text-emerald-600">{formatNumber(entry.total)} ₽</span>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return <div className="px-6 py-12 text-center text-muted-foreground text-sm">Загрузка...</div>;
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Поиск по рабочему, позиции..."
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
        <div className="flex-1 overflow-auto">
          <DataList
            columns={columns}
            data={filtered}
            getKey={(entry) => entry.id}
            activeId={selectedEntry?.id}
            onRowClick={(entry) => setSelectedEntry(entry)}
            emptyMessage="Нет операций за период"
          />
        </div>
      </div>
      <OperationPanel
        entry={selectedEntry}
        allEntries={logs}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Подключить ProductionTab к странице**

```tsx
// app/src/app/warehouse-v2/production/page.tsx
import { ProductionTab } from "@/components/warehouse-v2/tabs/ProductionTab";

export default function ProductionPage() {
  return <ProductionTab />;
}
```

- [ ] **Step 4: Проверить в браузере**

Run: http://localhost:3000/warehouse-v2/production
Expected: таблица операций за 30 дней, при клике — slide-over с рабочими и начислениями.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/warehouse-v2/tabs/ProductionTab.tsx \
       app/src/components/warehouse-v2/panels/OperationPanel.tsx \
       app/src/app/warehouse-v2/production/page.tsx
git commit -m "feat(warehouse-v2): ProductionTab with OperationPanel"
```

### Task 9: Финальная проверка и полировка

- [ ] **Step 1: Проверить build**

Run: `cd app && npm run build`
Expected: no errors

- [ ] **Step 2: Проверить все три таба в браузере**

- /warehouse-v2/items — список, фильтры, slide-over с карточкой и маршрутом
- /warehouse-v2/stock — список, фильтры, slide-over с движениями и actions
- /warehouse-v2/production — список, поиск, slide-over с деталями

- [ ] **Step 3: Проверить что старый /warehouse не сломан**

Run: http://localhost:3000/warehouse
Expected: работает как раньше, без изменений

- [ ] **Step 4: Финальный commit**

```bash
git add app/src/components/warehouse-v2/ app/src/app/warehouse-v2/
git commit -m "feat(warehouse-v2): complete UI 2.0 — three tabs with master-detail"
git push
```
