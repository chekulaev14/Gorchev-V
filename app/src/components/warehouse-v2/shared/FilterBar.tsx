'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  allLabel?: string;
}

interface DateRange {
  from: string;
  to: string;
}

interface Props {
  filters?: FilterConfig[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

export function FilterBar({
  filters,
  filterValues,
  onFilterChange,
  searchPlaceholder = 'Поиск...',
  searchValue,
  onSearchChange,
  dateRange,
  onDateRangeChange,
}: Props) {
  const [localSearch, setLocalSearch] = useState(searchValue);

  useEffect(() => {
    const timer = setTimeout(() => onSearchChange(localSearch), 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  useEffect(() => {
    if (searchValue !== localSearch) {
      setLocalSearch(searchValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-3">
      <Input
        placeholder={searchPlaceholder}
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
        className="bg-background border-border text-foreground text-sm h-9 w-full sm:max-w-xs"
      />
      {filters?.map((filter) => (
        <select
          key={filter.key}
          value={filterValues?.[filter.key] ?? ''}
          onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
          className="h-9 px-3 text-sm rounded-md border border-border bg-background text-foreground"
        >
          <option value="">{filter.allLabel ?? `Все ${filter.label}`}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
      {dateRange && onDateRangeChange && (
        <>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
            className="h-9 px-2 text-sm rounded-md border border-border bg-background text-foreground"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
            className="h-9 px-2 text-sm rounded-md border border-border bg-background text-foreground"
          />
        </>
      )}
    </div>
  );
}
