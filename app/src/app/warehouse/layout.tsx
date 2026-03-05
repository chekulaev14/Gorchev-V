"use client";

import { WarehouseProvider, useWarehouse } from "@/components/warehouse/WarehouseContext";
import { WarehouseNav } from "@/components/warehouse/WarehouseNav";
import { ThemeToggle } from "@/components/ThemeToggle";

function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useWarehouse();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-foreground text-base font-semibold">Склад</h1>
          <ThemeToggle />
        </div>
        <WarehouseNav />
      </header>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <WarehouseProvider>
      <WarehouseLayout>{children}</WarehouseLayout>
    </WarehouseProvider>
  );
}
