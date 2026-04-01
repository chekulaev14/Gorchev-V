'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FilterBar } from '../shared/FilterBar';
import { DataList } from '../shared/DataList';
import { StockItemPanel } from '../panels/StockItemPanel';
import { api } from '@/lib/api-client';
import { itemTypeLabels, unitLabels, typeColors, formatNumber } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import type { NomenclatureItem } from '@/lib/types';

const typeFilterOptions = [
  { value: 'material', label: 'Сырьё' },
  { value: 'blank', label: 'Заготовки' },
  { value: 'product', label: 'Изделия' },
];

export function StockTab() {
  const [items, setItems] = useState<NomenclatureItem[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<NomenclatureItem | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [nomData, stockData] = await Promise.all([
        api.get<{ items: NomenclatureItem[] }>('/api/nomenclature', { silent: true }),
        api.get<{ balances: Record<string, number> }>('/api/stock', { silent: true }),
      ]);
      setItems(nomData.items);
      setBalances(stockData.balances);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    let result = items.filter((i) => (balances[i.id] ?? 0) !== 0 || i.type !== 'blank');
    if (typeFilter) {
      result = result.filter((i) => i.type === typeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    return result;
  }, [items, balances, search, typeFilter]);

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Позиция',
        render: (item: NomenclatureItem) => (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs shrink-0 ${typeColors[item.type]}`}>
              {itemTypeLabels[item.type]}
            </Badge>
            <span className="text-foreground">{item.name}</span>
          </div>
        ),
      },
      {
        key: 'balance',
        header: 'Остаток',
        width: '140px',
        align: 'right' as const,
        render: (item: NomenclatureItem) => {
          const bal = balances[item.id] ?? 0;
          return (
            <span className={`font-mono ${bal === 0 ? 'text-destructive' : 'text-foreground'}`}>
              {formatNumber(bal)} {unitLabels[item.unit]}
            </span>
          );
        },
      },
    ],
    [balances],
  );

  if (loading) {
    return <div className="px-6 py-12 text-center text-muted-foreground text-sm">Загрузка...</div>;
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Поиск по названию..."
          filters={[{ key: 'type', label: 'тип', options: typeFilterOptions }]}
          filterValues={{ type: typeFilter }}
          onFilterChange={(key, value) => {
            if (key === 'type') setTypeFilter(value);
          }}
        />
        <div className="flex-1 overflow-auto">
          <DataList
            columns={columns}
            data={filtered}
            getKey={(item) => item.id}
            activeId={selectedItem?.id}
            onRowClick={(item) => setSelectedItem(item)}
            emptyMessage="Нет позиций с остатками"
          />
        </div>
      </div>
      <StockItemPanel
        item={selectedItem}
        balance={selectedItem ? (balances[selectedItem.id] ?? 0) : 0}
        onClose={() => setSelectedItem(null)}
        onRefresh={() => {
          fetchData();
          setSelectedItem(null);
        }}
      />
    </div>
  );
}
