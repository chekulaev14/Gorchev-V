"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NomenclatureTab } from "./NomenclatureTab";
import { StockTab } from "./StockTab";
import { OperationsTab } from "./OperationsTab";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { NomenclatureItem } from "@/lib/types";
import { api } from "@/lib/api-client";

export function WarehousePanel() {
  const [items, setItems] = useState<NomenclatureItem[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 py-3 bg-card border-b border-border flex items-center justify-between">
        <h1 className="text-foreground text-base font-semibold">Склад</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="/"
            className="text-muted-foreground text-xs hover:text-foreground transition-colors"
          >
            ← На главную
          </a>
        </div>
      </header>

      <div className="p-4">
        <Tabs defaultValue="nomenclature" className="w-full">
          <TabsList className="bg-card border border-border mb-4">
            <TabsTrigger
              value="nomenclature"
              className="data-[state=active]:bg-accent data-[state=active]:text-foreground text-muted-foreground text-xs"
            >
              Номенклатура
            </TabsTrigger>
            <TabsTrigger
              value="stock"
              className="data-[state=active]:bg-accent data-[state=active]:text-foreground text-muted-foreground text-xs"
            >
              Остатки
            </TabsTrigger>
            <TabsTrigger
              value="operations"
              className="data-[state=active]:bg-accent data-[state=active]:text-foreground text-muted-foreground text-xs"
            >
              Операции
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nomenclature">
            <NomenclatureTab items={items} balances={balances} />
          </TabsContent>
          <TabsContent value="stock">
            <StockTab items={items} balances={balances} onRefresh={fetchData} />
          </TabsContent>
          <TabsContent value="operations">
            <OperationsTab items={items} balances={balances} onRefresh={fetchData} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
