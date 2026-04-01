'use client';

import { SlideOverPanel } from '@/components/warehouse-v2/shared/SlideOverPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statusLabels, statusColors, mockDocuments, type Order } from '../mock/data';

interface Props {
  order: Order | null;
  onClose: () => void;
}

export function OrderPanel({ order, onClose }: Props) {
  if (!order) return null;

  const orderDocs = mockDocuments.filter((d) => d.orderId === order.id);

  return (
    <SlideOverPanel open={!!order} onClose={onClose} title={`Заказ ${order.number}`}>
      <div className="space-y-5">
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${statusColors[order.status]}`}>
              {statusLabels[order.status]}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Заказчик:</span>{' '}
              <span className="text-foreground">{order.customer}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Дата:</span>{' '}
              <span className="text-foreground">
                {new Date(order.createdAt).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Документы</h3>
          {orderDocs.length === 0 ? (
            <p className="text-muted-foreground text-xs">Нет документов</p>
          ) : (
            <div className="space-y-1">
              {orderDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-border/30"
                >
                  <span className="text-foreground">
                    {doc.number} (v{doc.version})
                  </span>
                  <Badge variant="outline" className={`text-xs ${statusColors[doc.status]}`}>
                    {statusLabels[doc.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Coverage</h3>
          <div className="space-y-1">
            {order.coverage.map((c) => (
              <div key={c.type} className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2">
                  <span className={c.covered ? 'text-emerald-600' : 'text-muted-foreground'}>
                    {c.covered ? '\u2714' : '\u25CB'}
                  </span>
                  <span className="text-foreground">{c.type}</span>
                  {c.covered && <span className="text-muted-foreground text-xs">({c.count})</span>}
                </div>
                {!c.covered && (
                  <Button size="sm" variant="outline" className="h-6 text-xs" disabled>
                    Подобрать
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Действия</h3>
          <div className="flex gap-2">
            <Button size="sm" disabled>
              Собрать пакет
            </Button>
            <Button size="sm" variant="outline" disabled>
              Проверить покрытие
            </Button>
          </div>
          <p className="text-muted-foreground text-xs mt-2">
            Действия будут доступны после подключения бэкенда
          </p>
        </section>
      </div>
    </SlideOverPanel>
  );
}
