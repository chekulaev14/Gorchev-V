"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useWarehouse } from "./WarehouseContext";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type OrderStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface SnapshotItem {
  itemId: string;
  itemName: string;
  quantity: number;
}

interface Order {
  id: string;
  status: OrderStatus;
  itemId: string;
  itemName: string;
  quantityPlanned: number;
  quantityCompleted: number;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  snapshotItems: SnapshotItem[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  PLANNED: "Запланирован",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PLANNED: "bg-blue-100 text-blue-800 border-blue-300",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-300",
};

export function OrdersTab() {
  const { items, session } = useWarehouse();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create form
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");

  const productItems = items.filter((i) => i.type === "product" && !i.isDeleted);

  const fetchOrders = useCallback(async () => {
    try {
      const url = filter === "ALL" ? "/api/production-orders" : `/api/production-orders?status=${filter}`;
      const data = await api.get<Order[]>(url, { silent: true });
      setOrders(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (session) fetchOrders();
  }, [session, fetchOrders]);

  async function handleAction(action: string, orderId: string) {
    setActionLoading(true);
    try {
      const data = await api.post<Order>("/api/production-orders", { action, orderId }, { silent: true });
      setDetailOrder(data);
      fetchOrders();
    } catch (err) {
      if (err instanceof ApiError && err.data.shortages) {
        const details = err.data.shortages.map((s) =>
          `${s.name} (нужно ${s.needed}, есть ${s.available})`
        ).join(", ");
        toast.error(err.data.error, { description: details });
      } else if (err instanceof ApiError) {
        toast.error(err.data.error);
      } else {
        toast.error("Ошибка связи");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreate() {
    if (!selectedItemId || !quantity) return;
    setActionLoading(true);
    try {
      await api.post("/api/production-orders", {
        action: "CREATE",
        itemId: selectedItemId,
        quantityPlanned: Number(quantity),
      });
      toast.success("Заказ создан");
      setCreateOpen(false);
      setSelectedItemId("");
      setQuantity("");
      fetchOrders();
    } catch {
      // toast shown by api-client
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Загрузка...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {(["ALL", "PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter(s)}
            >
              {s === "ALL" ? "Все" : STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
        <Button size="sm" className="h-7 text-xs" onClick={() => setCreateOpen(true)}>
          + Новый заказ
        </Button>
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">Нет заказов</p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => setDetailOrder(order)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className={`text-xs shrink-0 ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </Badge>
                  <span className="text-sm font-medium text-foreground truncate">{order.itemName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-sm">
                  <span className="text-muted-foreground">
                    {order.quantityCompleted}/{order.quantityPlanned} шт
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(order.createdAt).toLocaleDateString("ru-RU", {
                      day: "2-digit", month: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый производственный заказ</DialogTitle>
            <DialogDescription>Выберите изделие и количество для производства</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Изделие</label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите изделие" />
                </SelectTrigger>
                <SelectContent>
                  {productItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Количество</label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Количество"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button
              onClick={handleCreate}
              disabled={!selectedItemId || !quantity || actionLoading}
            >
              {actionLoading ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailOrder} onOpenChange={(open) => { if (!open) setDetailOrder(null); }}>
        {detailOrder && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{detailOrder.itemName}</DialogTitle>
              <DialogDescription>
                Заказ от {new Date(detailOrder.createdAt).toLocaleDateString("ru-RU")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={STATUS_COLORS[detailOrder.status]}>
                  {STATUS_LABELS[detailOrder.status]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {detailOrder.quantityCompleted}/{detailOrder.quantityPlanned} шт
                </span>
              </div>

              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">Создал: {detailOrder.creatorName}</p>
                {detailOrder.startedAt && (
                  <p className="text-muted-foreground">
                    Начат: {new Date(detailOrder.startedAt).toLocaleString("ru-RU")}
                  </p>
                )}
                {detailOrder.completedAt && (
                  <p className="text-muted-foreground">
                    Завершён: {new Date(detailOrder.completedAt).toLocaleString("ru-RU")}
                  </p>
                )}
              </div>

              {detailOrder.snapshotItems.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Состав (на 1 шт):</p>
                  <div className="space-y-0.5">
                    {detailOrder.snapshotItems.map((si) => (
                      <div key={si.itemId} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{si.itemName}</span>
                        <span className="text-foreground font-mono">{si.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
            <DialogFooter>
              {detailOrder.status === "PLANNED" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleAction("CANCEL", detailOrder.id)}
                    disabled={actionLoading}
                    className="text-destructive"
                  >
                    Отменить
                  </Button>
                  <Button
                    onClick={() => handleAction("START", detailOrder.id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "..." : "Запустить"}
                  </Button>
                </>
              )}
              {detailOrder.status === "IN_PROGRESS" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleAction("CANCEL", detailOrder.id)}
                    disabled={actionLoading}
                    className="text-destructive"
                  >
                    Отменить
                  </Button>
                  <Button
                    onClick={() => handleAction("COMPLETE", detailOrder.id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "..." : "Завершить"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
