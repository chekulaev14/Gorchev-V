'use client';

import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/warehouse-v2/shared/FilterBar';
import { DataList } from '@/components/warehouse-v2/shared/DataList';
import { CertificatePanel } from '../panels/CertificatePanel';
import { Badge } from '@/components/ui/badge';
import { mockCertificates, statusLabels, statusColors, type Certificate } from '../mock/data';

const statusFilterOptions = [
  { value: 'uploaded', label: 'Загружены' },
  { value: 'parsed', label: 'Распознаны' },
  { value: 'verified', label: 'Проверены' },
];

export function CertificatesTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Certificate | null>(null);

  const filtered = useMemo(() => {
    let result = mockCertificates;
    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.number.toLowerCase().includes(q) ||
          c.grade.toLowerCase().includes(q) ||
          c.supplier.toLowerCase().includes(q),
      );
    }
    return result;
  }, [search, statusFilter]);

  const columns = useMemo(
    () => [
      {
        key: 'number',
        header: '№',
        width: '100px',
        render: (cert: Certificate) => (
          <span className="text-foreground font-medium">{cert.number}</span>
        ),
      },
      {
        key: 'grade',
        header: 'Марка',
        width: '100px',
        render: (cert: Certificate) => <span className="text-foreground">{cert.grade}</span>,
      },
      {
        key: 'supplier',
        header: 'Поставщик',
        render: (cert: Certificate) => <span className="text-foreground">{cert.supplier}</span>,
      },
      {
        key: 'status',
        header: 'Статус',
        width: '120px',
        render: (cert: Certificate) => (
          <Badge variant="outline" className={`text-xs ${statusColors[cert.status]}`}>
            {statusLabels[cert.status]}
          </Badge>
        ),
      },
      {
        key: 'confidence',
        header: 'OCR',
        width: '80px',
        align: 'right' as const,
        render: (cert: Certificate) => (
          <span
            className={`text-sm ${cert.confidence >= 90 ? 'text-emerald-600' : cert.confidence > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}
          >
            {cert.confidence > 0 ? `${cert.confidence}%` : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Поиск по номеру, марке, поставщику..."
          filters={[{ key: 'status', label: 'статус', options: statusFilterOptions }]}
          filterValues={{ status: statusFilter }}
          onFilterChange={(key, value) => {
            if (key === 'status') setStatusFilter(value);
          }}
        />
        <div className="flex-1 overflow-auto">
          <DataList
            columns={columns}
            data={filtered}
            getKey={(c) => c.id}
            activeId={selected?.id}
            onRowClick={(c) => setSelected(c)}
            emptyMessage="Нет сертификатов"
          />
        </div>
      </div>
      <CertificatePanel cert={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
