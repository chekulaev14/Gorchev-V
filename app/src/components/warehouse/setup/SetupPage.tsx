"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NomenclatureSetupTab } from "./NomenclatureSetupTab";
import { StockSetupTab } from "./StockSetupTab";
import { BomSetupTab } from "./BomSetupTab";
import { RoutingSetupTab } from "./RoutingSetupTab";

export function SetupPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Массовая загрузка</h1>

      <Tabs defaultValue="nomenclature">
        <TabsList>
          <TabsTrigger value="nomenclature">Номенклатура</TabsTrigger>
          <TabsTrigger value="stock">Остатки</TabsTrigger>
          <TabsTrigger value="bom">Состав (BOM)</TabsTrigger>
          <TabsTrigger value="routing">Маршруты</TabsTrigger>
        </TabsList>

        <TabsContent value="nomenclature" className="mt-3">
          <NomenclatureSetupTab />
        </TabsContent>

        <TabsContent value="stock" className="mt-3">
          <StockSetupTab />
        </TabsContent>

        <TabsContent value="bom" className="mt-3">
          <BomSetupTab />
        </TabsContent>

        <TabsContent value="routing" className="mt-3">
          <RoutingSetupTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
