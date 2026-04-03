'use client';

import { useState } from 'react';
import type { ValidationError } from './constructor-types';

interface StatusBarProps {
  nodeCount: number;
  materialCount: number;
  blankCount: number;
  productCount: number;
  errors: ValidationError[];
  onErrorClick: (nodeId?: string) => void;
}

function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${n} ${many}`;
  if (last > 1 && last < 5) return `${n} ${few}`;
  if (last === 1) return `${n} ${one}`;
  return `${n} ${many}`;
}

export function ConstructorStatusBar({
  nodeCount,
  materialCount,
  blankCount,
  productCount,
  errors,
  onErrorClick,
}: StatusBarProps) {
  const [showErrors, setShowErrors] = useState(false);
  const hasErrors = errors.length > 0;

  return (
    <div className="relative flex items-center justify-between px-4 h-9 border-t border-gray-200 bg-white text-[12px] text-gray-500 shrink-0">
      {/* Left: counts */}
      <div className="flex items-center gap-2">
        {nodeCount === 0 ? (
          <span>Пусто</span>
        ) : (
          <>
            <span>{plural(nodeCount, 'элемент', 'элемента', 'элементов')}</span>
            <span className="text-gray-300">&middot;</span>
            <span>{materialCount} сырьё</span>
            <span className="text-gray-300">&middot;</span>
            <span>{plural(blankCount, 'заготовка', 'заготовки', 'заготовок')}</span>
            <span className="text-gray-300">&middot;</span>
            <span>{plural(productCount, 'изделие', 'изделия', 'изделий')}</span>
          </>
        )}
      </div>

      {/* Right: errors */}
      <div className="flex items-center">
        {hasErrors ? (
          <button
            className="flex items-center gap-1 hover:text-red-700"
            data-testid="status-errors"
            onClick={() => setShowErrors((p) => !p)}
          >
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#dc2626' }} />
            <span className="text-red-600 font-medium">
              {plural(errors.length, 'ошибка', 'ошибки', 'ошибок')}
            </span>
          </button>
        ) : (
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
            Без ошибок
          </span>
        )}
      </div>

      {/* Expandable error panel */}
      {showErrors && hasErrors && (
        <div className="absolute bottom-full left-0 right-0 bg-white border border-gray-200 rounded-t-lg shadow-lg max-h-48 overflow-y-auto z-10">
          {errors.map((err, i) => (
            <div
              key={`${err.code}-${i}`}
              className="flex items-center gap-2 px-4 py-2 text-[12px] hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              data-testid={`error-${err.code}-${i}`}
              data-error-code={err.code}
              onClick={() => {
                onErrorClick(err.nodeId);
                setShowErrors(false);
              }}
            >
              <span className="text-amber-500 shrink-0">&#x26a0;</span>
              <span className="flex-1 text-gray-700">{err.message}</span>
              <span className="text-[10px] text-gray-400 font-mono">{err.code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
