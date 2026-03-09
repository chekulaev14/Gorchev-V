"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { GroupedAccordion } from "@/components/ui/grouped-accordion";
import { useWarehouse } from "@/components/warehouse/WarehouseContext";
import { ItemForm, emptyItemFormValues, type ItemFormValues } from "@/components/warehouse/ItemForm";
import type { NomenclatureItem, ItemType, PotentialItem } from "@/lib/types";
import { itemTypeLabels, unitLabels, typeColors, formatNumber } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { createItemSchema } from "@/lib/schemas/nomenclature.schema";
import { toast } from "sonner";

interface Props {
  items: NomenclatureItem[];
  balances: Record<string, number>;
}

const typeOrder: ItemType[] = ["material", "blank", "product"];

export function NomenclatureTab({ items, balances }: Props) {
  const router = useRouter();
  const { editMode, refreshAll } = useWarehouse();
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<ItemFormValues>({ ...emptyItemFormValues });
  const [addSaving, setAddSaving] = useState(false);

  // Потенциал
  const [potentialMap, setPotentialMap] = useState<Record<string, number>>({});
  const fetchPotential = useCallback(() => {
    api.get<{ items: PotentialItem[] }>("/api/stock/potential", { silent: true })
      .then((d) => {
        const map: Record<string, number> = {};
        for (const p of d.items) map[p.itemId] = p.potential;
        setPotentialMap(map);
      })
      .catch(() => {});
  }, []);
  useEffect(() => { fetchPotential(); }, [fetchPotential]);
  const balancesKey = useMemo(() => JSON.stringify(balances), [balances]);
  useEffect(() => { fetchPotential(); }, [balancesKey, fetchPotential]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q)
    );
  }, [items, search]);

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.type !== b.type) return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
      return a.name.localeCompare(b.name, "ru");
    });
  }, [filtered]);

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;

    const { quantity, ...nomData } = addForm;
    const parsed = createItemSchema.safeParse({
      ...nomData,
      pricePerUnit: nomData.pricePerUnit ? Number(nomData.pricePerUnit) : null,
      categoryId: nomData.categoryId || null,
      description: nomData.description || null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Ошибка валидации");
      return;
    }

    setAddSaving(true);
    try {
      const created = await api.post<{ id: string }>("/api/nomenclature", parsed.data);
      const qty = Number(quantity);
      if (qty > 0) {
        await api.post("/api/stock", {
          action: "SUPPLIER_INCOME",
          itemId: created.id,
          quantity: qty,
          comment: "Начальный остаток",
        });
      }
      setShowAddForm(false);
      setAddForm({ ...emptyItemFormValues });
      refreshAll();
    } catch {
      // toast shown by api-client
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Поиск по названию, артикулу..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-card border-border text-foreground placeholder:text-muted-foreground text-sm h-9 w-full sm:max-w-xs"
        />

        {editMode && (
          <Button
            size="sm"
            className="h-9 text-xs sm:ml-auto"
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
          >
            + Добавить позицию
          </Button>
        )}
      </div>

      {showAddForm && (
        <ItemForm
          mode="create"
          values={addForm}
          onChange={setAddForm}
          onSubmit={handleAdd}
          onCancel={() => { setShowAddForm(false); setAddForm({ ...emptyItemFormValues }); }}
          saving={addSaving}
          title="Новая позиция"
        />
      )}

      {!showAddForm && (
      <>
      <p className="text-muted-foreground text-sm">{filtered.length} позиций</p>

      <GroupedAccordion
        items={sortedFiltered}
        groupBy={(item) => item.type}
        groupOrder={typeOrder}
        searchQuery={search || undefined}
        renderGroupHeader={(type, group) => (
          <>
            <Badge variant="outline" className={`text-sm px-2.5 py-0.5 ${typeColors[type]}`}>
              {itemTypeLabels[type]}
            </Badge>
            <span className="text-muted-foreground text-sm">{group.length} поз.</span>
          </>
        )}
        renderGroupContent={(_type, group) => (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-sm font-medium h-8 pl-10">Наименование</TableHead>
                <TableHead className="text-muted-foreground text-sm font-medium h-8 w-20 text-right">Остаток</TableHead>
                <TableHead className="text-muted-foreground text-sm font-medium h-8 w-24 text-right">Потенциал</TableHead>
                <TableHead className="text-muted-foreground text-sm font-medium h-8 w-12 text-right">Ед.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-border/50 cursor-pointer hover:bg-accent/50"
                  onClick={() => router.push(`/warehouse/nomenclature/${item.id}`)}
                >
                  <TableCell className="py-2 pl-10">
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        {item.name}
                        {item.type === "product" && item.weight ? (
                          <span className="text-muted-foreground text-xs font-normal ml-2">{item.weight} кг</span>
                        ) : null}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <span className="text-foreground text-sm font-mono">
                      {formatNumber(balances[item.id] ?? 0)}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    {item.type !== "material" && potentialMap[item.id] !== undefined ? (
                      <span className={`text-sm font-mono ${potentialMap[item.id] > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {formatNumber(potentialMap[item.id])}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <span className="text-muted-foreground text-sm">{unitLabels[item.unit]}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      />
      </>
      )}
    </div>
  );
}
