'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { SlideOverPanel } from '../shared/SlideOverPanel';
import { RoutingPreview } from '../shared/RoutingPreview';
import { api } from '@/lib/api-client';
import {
  itemTypeLabels,
  unitLabels,
  typeColors,
  formatNumber,
  movementTypeLabels,
} from '@/lib/constants';
import type { NomenclatureItem, StockMovement } from '@/lib/types';

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
          const active = d.routings?.find((r) => r.status === 'ACTIVE');
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

  const routingSteps =
    routing?.steps.map((s) => ({
      stepNo: s.stepNo,
      outputItemName: s.outputItem.name,
      outputQty: Number(s.outputQty),
      outputUnit:
        s.outputItem.unit in unitLabels
          ? unitLabels[s.outputItem.unit as keyof typeof unitLabels]
          : s.outputItem.unit,
      inputs: s.inputs.map((inp) => ({
        itemId: inp.item.id,
        itemName: inp.item.name,
        quantity: Number(inp.quantity),
        unit:
          inp.item.unit in unitLabels
            ? unitLabels[inp.item.unit as keyof typeof unitLabels]
            : inp.item.unit,
      })),
    })) ?? [];

  return (
    <SlideOverPanel open={!!item} onClose={onClose} title={item.name}>
      {loading ? (
        <p className="text-muted-foreground text-sm">Загрузка...</p>
      ) : (
        <div className="space-y-5">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${typeColors[item.type]}`}>
                {itemTypeLabels[item.type]}
              </Badge>
              {item.side && item.side !== 'NONE' && (
                <Badge variant="outline" className="text-xs">
                  {item.side === 'LEFT' ? 'Л' : 'П'}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Код:</span>{' '}
                <span className="text-foreground">{item.code}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ед.:</span>{' '}
                <span className="text-foreground">{unitLabels[item.unit]}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Остаток:</span>{' '}
                <span className="text-foreground font-mono">
                  {formatNumber(balance)} {unitLabels[item.unit]}
                </span>
              </div>
              {item.pricePerUnit != null && (
                <div>
                  <span className="text-muted-foreground">Тариф:</span>{' '}
                  <span className="text-foreground">{item.pricePerUnit} ₽</span>
                </div>
              )}
            </div>
          </section>

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
                      {new Date(m.date).toLocaleDateString('ru-RU')}
                    </span>
                    <span className="text-foreground">{movementTypeLabels[m.type] ?? m.type}</span>
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
