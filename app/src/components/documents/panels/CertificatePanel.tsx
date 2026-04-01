'use client';

import { SlideOverPanel } from '@/components/warehouse-v2/shared/SlideOverPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statusLabels, statusColors, type Certificate } from '../mock/data';

interface Props {
  cert: Certificate | null;
  onClose: () => void;
}

export function CertificatePanel({ cert, onClose }: Props) {
  if (!cert) return null;

  return (
    <SlideOverPanel open={!!cert} onClose={onClose} title={cert.number}>
      <div className="space-y-5">
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${statusColors[cert.status]}`}>
              {statusLabels[cert.status]}
            </Badge>
            {cert.confidence > 0 && (
              <span
                className={`text-xs ${cert.confidence >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}
              >
                OCR: {cert.confidence}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Марка:</span>{' '}
              <span className="text-foreground">{cert.grade}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Стандарт:</span>{' '}
              <span className="text-foreground">{cert.standard}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Поставщик:</span>{' '}
              <span className="text-foreground">{cert.supplier}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Дата:</span>{' '}
              <span className="text-foreground">
                {new Date(cert.createdAt).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">PDF</h3>
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground text-sm">Превью PDF будет здесь</p>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Действия</h3>
          <div className="flex gap-2">
            {cert.status === 'uploaded' && (
              <Button size="sm" disabled>
                Распознать (OCR)
              </Button>
            )}
            {cert.status === 'parsed' && (
              <Button size="sm" disabled>
                Проверить
              </Button>
            )}
            {cert.status === 'verified' && (
              <span className="text-emerald-600 text-sm">Проверен ✓</span>
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
