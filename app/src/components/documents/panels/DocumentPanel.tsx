'use client';

import { SlideOverPanel } from '@/components/warehouse-v2/shared/SlideOverPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statusLabels, statusColors, mockCertificates, type Document } from '../mock/data';

interface Props {
  doc: Document | null;
  onClose: () => void;
}

export function DocumentPanel({ doc, onClose }: Props) {
  if (!doc) return null;

  // Mock: show first N certificates as "attached"
  const attachedCerts = mockCertificates.slice(0, doc.certificatesCount);

  return (
    <SlideOverPanel open={!!doc} onClose={onClose} title={`${doc.number} (v${doc.version})`}>
      <div className="space-y-5">
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${statusColors[doc.status]}`}>
              {statusLabels[doc.status]}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Заказ:</span>{' '}
              <span className="text-foreground">{doc.orderNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Версия:</span>{' '}
              <span className="text-foreground">{doc.version}</span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Сертификаты</h3>
          {attachedCerts.length === 0 ? (
            <p className="text-muted-foreground text-xs">Нет сертификатов</p>
          ) : (
            <div className="space-y-1">
              {attachedCerts.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-border/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-foreground">{cert.number}</span>
                    <span className="text-muted-foreground">{cert.grade}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">metal</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Результат</h3>
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground text-sm">Превью PDF будет здесь</p>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Действия</h3>
          <div className="flex gap-2">
            <Button size="sm" disabled>
              Сгенерировать PDF
            </Button>
            {doc.status === 'draft' && (
              <Button size="sm" variant="outline" disabled>
                Выпустить
              </Button>
            )}
            {doc.status === 'issued' && (
              <Button size="sm" variant="outline" disabled>
                Клонировать (v{doc.version + 1})
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs mt-2">
            Действия будут доступны после подключения бэкенда
          </p>
        </section>
      </div>
    </SlideOverPanel>
  );
}
