'use client';

import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/warehouse-v2/shared/FilterBar';
import { DataList } from '@/components/warehouse-v2/shared/DataList';
import { DocumentPanel } from '../panels/DocumentPanel';
import { Badge } from '@/components/ui/badge';
import { mockDocuments, statusLabels, statusColors, type Document } from '../mock/data';

const statusFilterOptions = [
  { value: 'draft', label: 'Черновики' },
  { value: 'issued', label: 'Выпущенные' },
];

export function DocumentsListTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Document | null>(null);

  const filtered = useMemo(() => {
    let result = mockDocuments;
    if (statusFilter) {
      result = result.filter((d) => d.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) => d.number.toLowerCase().includes(q) || d.orderNumber.toLowerCase().includes(q),
      );
    }
    return result;
  }, [search, statusFilter]);

  const columns = useMemo(
    () => [
      {
        key: 'number',
        header: 'Документ',
        width: '100px',
        render: (doc: Document) => (
          <span className="text-foreground font-medium">{doc.number}</span>
        ),
      },
      {
        key: 'order',
        header: 'Заказ',
        width: '80px',
        render: (doc: Document) => <span className="text-muted-foreground">{doc.orderNumber}</span>,
      },
      {
        key: 'version',
        header: 'v',
        width: '40px',
        render: (doc: Document) => <span className="text-muted-foreground">{doc.version}</span>,
      },
      {
        key: 'certs',
        header: 'Серт.',
        width: '60px',
        align: 'right' as const,
        render: (doc: Document) => (
          <span className="text-muted-foreground">{doc.certificatesCount}</span>
        ),
      },
      {
        key: 'status',
        header: 'Статус',
        width: '120px',
        render: (doc: Document) => (
          <Badge variant="outline" className={`text-xs ${statusColors[doc.status]}`}>
            {statusLabels[doc.status]}
          </Badge>
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
          searchPlaceholder="Поиск по номеру, заказу..."
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
            getKey={(d) => d.id}
            activeId={selected?.id}
            onRowClick={(d) => setSelected(d)}
            emptyMessage="Нет документов"
          />
        </div>
      </div>
      <DocumentPanel doc={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
