'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FilterBar } from '../shared/FilterBar';
import { DataList } from '../shared/DataList';
import { ItemPanel } from '../panels/ItemPanel';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { itemTypeLabels, unitLabels, typeColors, formatNumber } from '@/lib/constants';
import type { NomenclatureItem } from '@/lib/types';
import { typeFilterOptions } from '../shared/constants';

export function NomenclatureTab() {
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
    let result = items;
    if (typeFilter) {
      result = result.filter((i) => i.type === typeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, search, typeFilter]);

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Наименование',
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
        key: 'code',
        header: 'Код',
        width: '120px',
        render: (item: NomenclatureItem) => (
          <span className="text-muted-foreground">{item.code}</span>
        ),
      },
      {
        key: 'balance',
        header: 'Остаток',
        width: '120px',
        align: 'right' as const,
        render: (item: NomenclatureItem) => (
          <span className="font-mono text-foreground">
            {formatNumber(balances[item.id] ?? 0)} {unitLabels[item.unit]}
          </span>
        ),
      },
      {
        key: 'hasRoute',
        header: 'Маршрут',
        width: '80px',
        render: (item: NomenclatureItem) => (
          <span className={item.hasRecipe ? 'text-emerald-600' : 'text-muted-foreground'}>
            {item.hasRecipe ? 'Да' : 'Нет'}
          </span>
        ),
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
          searchPlaceholder="Поиск по названию, коду..."
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
            emptyMessage="Нет позиций"
          />
        </div>
      </div>
      <ItemPanel
        item={selectedItem}
        balance={selectedItem ? (balances[selectedItem.id] ?? 0) : 0}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
