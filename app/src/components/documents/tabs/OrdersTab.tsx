'use client';

import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/warehouse-v2/shared/FilterBar';
import { DataList } from '@/components/warehouse-v2/shared/DataList';
import { OrderPanel } from '../panels/OrderPanel';
import { Badge } from '@/components/ui/badge';
import { mockOrders, statusLabels, statusColors, type Order } from '../mock/data';

const statusFilterOptions = [
  { value: 'active', label: 'Активные' },
  { value: 'completed', label: 'Завершённые' },
];

export function OrdersTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    let result = mockOrders;
    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) => o.number.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q),
      );
    }
    return result;
  }, [search, statusFilter]);

  const columns = useMemo(
    () => [
      {
        key: 'number',
        header: 'Заказ',
        width: '100px',
        render: (order: Order) => (
          <span className="text-foreground font-medium">{order.number}</span>
        ),
      },
      {
        key: 'customer',
        header: 'Заказчик',
        render: (order: Order) => <span className="text-foreground">{order.customer}</span>,
      },
      {
        key: 'docs',
        header: 'Док',
        width: '60px',
        align: 'right' as const,
        render: (order: Order) => (
          <span className="text-muted-foreground">{order.documentsCount}</span>
        ),
      },
      {
        key: 'status',
        header: 'Статус',
        width: '120px',
        render: (order: Order) => (
          <Badge variant="outline" className={`text-xs ${statusColors[order.status]}`}>
            {statusLabels[order.status]}
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
          searchPlaceholder="Поиск по номеру, заказчику..."
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
            getKey={(o) => o.id}
            activeId={selectedOrder?.id}
            onRowClick={(o) => setSelectedOrder(o)}
            emptyMessage="Нет заказов"
          />
        </div>
      </div>
      <OrderPanel order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}
