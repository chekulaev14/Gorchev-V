"use client";

import { useState, useEffect, useCallback } from "react";
import { useWarehouse } from "@/components/warehouse/WarehouseContext";
import { BomItemList } from "./BomItemList";
import { BomEditor } from "./BomEditor";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { NomenclatureItem } from "@/lib/types";

export interface BomVersion {
  id: string;
  itemId: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  lines: BomVersionLine[];
}

export interface BomVersionLine {
  id: string;
  lineNo: number;
  componentItemId: string;
  componentName: string;
  componentCode: string;
  quantity: number;
  scrapFactor: number | null;
  note: string | null;
}

export function BomConstructor() {
  const { items } = useWarehouse();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [versions, setVersions] = useState<BomVersion[]>([]);
  const [loading, setLoading] = useState(false);

  // Фильтруем только blanks и products
  const eligibleItems = items.filter((i) => i.type === "blank" || i.type === "product");

  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;

  const loadVersions = useCallback(async (itemId: string) => {
    setLoading(true);
    try {
      const data = await api.get<BomVersion[]>(`/api/bom/versions?itemId=${itemId}`, { silent: true });
      setVersions(data);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedItemId) {
      loadVersions(selectedItemId);
    } else {
      setVersions([]);
    }
  }, [selectedItemId, loadVersions]);

  const handleCreateDraft = async (lines: { componentItemId: string; quantity: number }[]) => {
    if (!selectedItemId) return;
    try {
      await api.post("/api/bom/versions", { itemId: selectedItemId, lines });
      toast.success("Черновик создан");
      loadVersions(selectedItemId);
    } catch {
      // toast by api-client
    }
  };

  const handleUpdateDraft = async (bomId: string, lines: { componentItemId: string; quantity: number }[]) => {
    try {
      await api.put(`/api/bom/versions/${bomId}`, { lines });
      toast.success("Черновик сохранён");
      if (selectedItemId) loadVersions(selectedItemId);
    } catch {
      // toast by api-client
    }
  };

  const handleActivate = async (bomId: string) => {
    try {
      await api.put(`/api/bom/versions/${bomId}/activate`);
      toast.success("Версия активирована");
      if (selectedItemId) loadVersions(selectedItemId);
    } catch {
      // toast by api-client
    }
  };

  const handleDeleteDraft = async (bomId: string) => {
    try {
      await api.del(`/api/bom/versions/${bomId}`);
      toast.success("Черновик удалён");
      if (selectedItemId) loadVersions(selectedItemId);
    } catch {
      // toast by api-client
    }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      <BomItemList
        items={eligibleItems}
        selectedId={selectedItemId}
        onSelect={setSelectedItemId}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {selectedItem ? (
          <BomEditor
            item={selectedItem}
            allItems={items}
            versions={versions}
            loading={loading}
            onCreateDraft={handleCreateDraft}
            onUpdateDraft={handleUpdateDraft}
            onActivate={handleActivate}
            onDeleteDraft={handleDeleteDraft}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Выберите позицию для редактирования состава
          </div>
        )}
      </div>
    </div>
  );
}
