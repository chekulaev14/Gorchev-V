'use client';

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'right';
  render: (item: T) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  getKey: (item: T) => string;
  activeId?: string | null;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function DataList<T>({
  columns,
  data,
  getKey,
  activeId,
  onRowClick,
  emptyMessage = 'Нет данных',
}: Props<T>) {
  if (data.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground text-sm">{emptyMessage}</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-6 py-2 text-xs font-medium text-muted-foreground ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const key = getKey(item);
            const isActive = activeId === key;
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-border/50 transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-accent/50' : ''
                } ${isActive ? 'bg-accent' : ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-6 py-2.5 text-sm ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
