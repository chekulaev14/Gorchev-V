"use client";

import { useState, useEffect } from "react";
import { useWarehouse } from "@/components/warehouse/WarehouseContext";
import { Button } from "@/components/ui/button";

interface LogEntry {
  id: string;
  workerName: string;
  itemName: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
  createdAt: string;
}

interface WorkerSummary {
  workerId: string;
  name: string;
  count: number;
  total: number;
}

export default function ProductionPage() {
  const { session } = useWarehouse();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<WorkerSummary[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.role !== "director") return;
    setLoading(true);
    fetch(`/api/terminal/logs?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs);
        setSummary(data.summary);
      })
      .finally(() => setLoading(false));
  }, [days, session]);

  if (session?.role !== "director") {
    return <p className="text-muted-foreground text-sm">Нет доступа</p>;
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Загрузка...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Период:</span>
        {[1, 7, 30].map((d) => (
          <Button
            key={d}
            variant={days === d ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setDays(d)}
          >
            {d === 1 ? "Сегодня" : d === 7 ? "Неделя" : "Месяц"}
          </Button>
        ))}
      </div>

      {summary.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3">
          <h3 className="text-sm font-medium text-foreground mb-2">Сводка по рабочим</h3>
          <div className="space-y-1.5">
            {summary.map((s) => (
              <div key={s.workerId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{s.name}</span>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">{s.count} шт</span>
                  <span className="text-emerald-600 font-medium">{s.total.toLocaleString()} ₽</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-4">Нет записей за выбранный период</p>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Дата</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Рабочий</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Деталь</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Кол-во</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(log.createdAt).toLocaleDateString("ru-RU", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2 text-foreground">{log.workerName}</td>
                  <td className="px-3 py-2 text-foreground">{log.itemName}</td>
                  <td className="px-3 py-2 text-right text-foreground">{log.quantity}</td>
                  <td className="px-3 py-2 text-right text-emerald-600 font-medium">{log.total} ₽</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
