'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FilterBar } from '../shared/FilterBar';
import { DataList } from '../shared/DataList';
import { OperationPanel, type ProductionLogEntry } from '../panels/OperationPanel';
import { api } from '@/lib/api-client';
import { formatNumber } from '@/lib/constants';

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export function ProductionTab() {
  const [logs, setLogs] = useState<ProductionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [selectedEntry, setSelectedEntry] = useState<ProductionLogEntry | null>(null);

  const days = useMemo(() => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
  }, [dateRange]);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.get<{ logs: ProductionLogEntry[] }>(
        `/api/terminal/logs?days=${days}`,
        { silent: true },
      );
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to + 'T23:59:59');
      setLogs(
        data.logs.filter((l) => {
          const d = new Date(l.createdAt);
          return d >= fromDate && d <= toDate;
        }),
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [days, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) => l.workerName.toLowerCase().includes(q) || l.itemName.toLowerCase().includes(q),
    );
  }, [logs, search]);

  const columns = useMemo(
    () => [
      {
        key: 'date',
        header: 'Дата',
        width: '130px',
        render: (entry: ProductionLogEntry) => (
          <span className="text-muted-foreground">
            {new Date(entry.createdAt).toLocaleDateString('ru-RU')}
          </span>
        ),
      },
      {
        key: 'worker',
        header: 'Рабочий',
        width: '160px',
        render: (entry: ProductionLogEntry) => (
          <span className="text-foreground">{entry.workerName}</span>
        ),
      },
      {
        key: 'item',
        header: 'Позиция',
        render: (entry: ProductionLogEntry) => (
          <span className="text-foreground">{entry.itemName}</span>
        ),
      },
      {
        key: 'quantity',
        header: 'Кол-во',
        width: '80px',
        align: 'right' as const,
        render: (entry: ProductionLogEntry) => (
          <span className="font-mono text-foreground">{formatNumber(entry.quantity)}</span>
        ),
      },
      {
        key: 'total',
        header: 'Начислено',
        width: '100px',
        align: 'right' as const,
        render: (entry: ProductionLogEntry) => (
          <span className="font-mono text-emerald-600">{formatNumber(entry.total)} ₽</span>
        ),
      },
    ],
    [],
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
          searchPlaceholder="Поиск по рабочему, позиции..."
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
        <div className="flex-1 overflow-auto">
          <DataList
            columns={columns}
            data={filtered}
            getKey={(entry) => entry.id}
            activeId={selectedEntry?.id}
            onRowClick={(entry) => setSelectedEntry(entry)}
            emptyMessage="Нет операций за период"
          />
        </div>
      </div>
      <OperationPanel
        entry={selectedEntry}
        allEntries={logs}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}
