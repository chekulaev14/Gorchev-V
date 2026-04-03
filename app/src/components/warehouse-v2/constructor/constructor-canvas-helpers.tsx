import type React from 'react';

// ── Constants ──

export const NODE_W = 180;
export const NODE_H = 110;

// ── Bezier path ──

export function buildBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.4;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// ── Ghost state (empty canvas) ──

export function GhostState({
  onStart,
  onDemo,
  onPaneClick,
}: {
  onStart: () => void;
  onDemo?: () => void;
  onPaneClick: () => void;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(circle, #d1d5db 0.75px, transparent 0.75px)',
        backgroundSize: '20px 20px',
      }}
      onClick={onPaneClick}
    >
      <div className="pointer-events-none flex items-center gap-8 opacity-30">
        <div className="flex h-[80px] w-[160px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white text-sm text-gray-400">
          Сырьё
        </div>
        <GhostArrow />
        <div className="flex h-[80px] w-[160px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white text-sm text-gray-400">
          Заготовка
        </div>
        <GhostArrow />
        <div className="flex h-[80px] w-[160px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white text-sm text-gray-400">
          Изделие
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
        >
          Начать с изделия
        </button>
        {onDemo && (
          <button
            type="button"
            className="text-sm text-gray-500 transition-colors hover:text-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              onDemo();
            }}
          >
            Загрузить демо
          </button>
        )}
      </div>
    </div>
  );
}

function GhostArrow() {
  return (
    <svg width="60" height="20">
      <path
        d="M 0 10 L 50 10"
        fill="none"
        stroke="#d1d5db"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      <path d="M 45 5 L 55 10 L 45 15 Z" fill="#d1d5db" />
    </svg>
  );
}

// ── Zoom controls ──

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: (e: React.MouseEvent) => void;
  onZoomOut: (e: React.MouseEvent) => void;
  onReset: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1 py-1 shadow-sm">
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded text-sm text-gray-600 transition-colors hover:bg-gray-100"
        onClick={onZoomIn}
      >
        +
      </button>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded text-sm text-gray-600 transition-colors hover:bg-gray-100"
        onClick={onZoomOut}
      >
        &minus;
      </button>
      <button
        type="button"
        className="flex h-7 items-center justify-center rounded px-1 text-xs text-gray-600 transition-colors hover:bg-gray-100"
        onClick={onReset}
      >
        1:1
      </button>
      <span className="ml-1 text-xs text-gray-400">{Math.round(zoom * 100)}%</span>
    </div>
  );
}
