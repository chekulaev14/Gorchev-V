'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SlideOverPanel } from '../shared/SlideOverPanel';
import { api } from '@/lib/api-client';
import { unitLabels, formatNumber } from '@/lib/constants';
import type { NomenclatureItem, StockMovement } from '@/lib/types';
import { toast } from 'sonner';

interface Props {
  item: NomenclatureItem | null;
  balance: number;
  onClose: () => void;
  onRefresh: () => void;
}

type ActionMode = null | 'income' | 'shipment' | 'adjustment';

const movementTypeLabels: Record<string, string> = {
  SUPPLIER_INCOME: 'Приход',
  PRODUCTION_INCOME: 'Производство',
  ASSEMBLY_WRITE_OFF: 'Списание',
  ASSEMBLY_INCOME: 'Производство',
  ADJUSTMENT_INCOME: 'Корректировка +',
  ADJUSTMENT_WRITE_OFF: 'Корректировка −',
  SHIPMENT_WRITE_OFF: 'Отгрузка',
};

export function StockItemPanel({ item, balance, onClose, onRefresh }: Props) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    setActionMode(null);
    setQuantity('');
    api
      .get<{ movements: StockMovement[] }>(`/api/stock?itemId=${item.id}`, { silent: true })
      .then((d) => setMovements(d.movements?.slice(0, 30) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [item]);

  if (!item) return null;

  const handleAction = async () => {
    if (!actionMode || !quantity || Number(quantity) <= 0) return;
    const actionMap = {
      income: 'SUPPLIER_INCOME',
      shipment: 'SHIPMENT',
      adjustment: 'ADJUSTMENT',
    } as const;

    setSubmitting(true);
    try {
      await api.post('/api/stock', {
        action: actionMap[actionMode],
        itemId: item.id,
        quantity: Number(quantity),
      });
      toast.success(
        actionMode === 'income'
          ? 'Оприходовано'
          : actionMode === 'shipment'
            ? 'Отгружено'
            : 'Скорректировано',
      );
      setActionMode(null);
      setQuantity('');
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

          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Действия</h3>
            {!actionMode ? (
              <div className="flex gap-2">
                {item.type === 'material' && (
                  <Button size="sm" variant="outline" onClick={() => setActionMode('income')}>
                    Приход
                  </Button>
                )}
                {item.type === 'product' && (
                  <Button size="sm" variant="outline" onClick={() => setActionMode('shipment')}>
                    Отгрузка
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setActionMode('adjustment')}>
                  Корректировка
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.01"
                  step={item.unit === 'kg' ? '0.1' : '1'}
                  placeholder="Кол-во"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-9 w-24 text-sm"
                  autoFocus
                />
                <Button size="sm" onClick={handleAction} disabled={submitting || !quantity}>
                  {submitting ? '...' : 'OK'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setActionMode(null);
                    setQuantity('');
                  }}
                >
                  Отмена
                </Button>
              </div>
            )}
          </section>

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
