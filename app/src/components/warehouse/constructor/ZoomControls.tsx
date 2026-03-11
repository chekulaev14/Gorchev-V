"use client";

interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function ZoomControls({
  zoom,
  onZoomChange,
  min = 0.4,
  max = 1.5,
  step = 0.1,
}: ZoomControlsProps) {
  const zoomIn = () => onZoomChange(Math.min(max, +(zoom + step).toFixed(2)));
  const zoomOut = () => onZoomChange(Math.max(min, +(zoom - step).toFixed(2)));
  const reset = () => onZoomChange(1);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={zoomOut}
        className="w-7 h-7 rounded-md border border-gray-200 bg-white text-gray-500 text-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
      >
        -
      </button>
      <span className="text-[11px] text-gray-400 min-w-[36px] text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={zoomIn}
        className="w-7 h-7 rounded-md border border-gray-200 bg-white text-gray-500 text-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
      >
        +
      </button>
      {zoom !== 1 && (
        <button
          type="button"
          onClick={reset}
          className="h-7 px-2 rounded-md border border-gray-200 bg-white text-[10px] text-gray-400 hover:text-gray-500 transition-colors"
        >
          Сброс
        </button>
      )}
    </div>
  );
}
