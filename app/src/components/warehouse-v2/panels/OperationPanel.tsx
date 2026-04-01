'use client';

import { SlideOverPanel } from '../shared/SlideOverPanel';
import { formatNumber } from '@/lib/constants';

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

  const operationWorkers: WorkerEntry[] = allEntries.map((e) => ({
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
            <span className="text-muted-foreground">Дата:</span>{' '}
            <span className="text-foreground">
              {new Date(entry.createdAt).toLocaleString('ru-RU')}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Всего:</span>{' '}
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
                  <span className="font-mono text-foreground">{formatNumber(w.quantity)} шт</span>
                  <span className="text-muted-foreground">x {w.pricePerUnit} ₽</span>
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
