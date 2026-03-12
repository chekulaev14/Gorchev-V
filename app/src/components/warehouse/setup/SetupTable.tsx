"use client";

import { useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MAX_ROWS } from "@/lib/schemas/setup-import.schema";
import type { SetupError } from "./useSetupImport";

// --- Types ---

export interface ColumnConfig {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  readonlyIfFromDb?: boolean;
  width?: string;
}

interface SetupTableProps {
  columns: ColumnConfig[];
  rows: Record<string, unknown>[];
  errors: SetupError[];
  onChange: (rows: Record<string, unknown>[]) => void;
  disabled?: boolean;
}

// --- Component ---

export function SetupTable({ columns, rows, errors, onChange, disabled }: SetupTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);

  const errorMap = new Map<string, string>();
  for (const err of errors) {
    const key = err.column ? `${err.row}:${err.column}` : `${err.row}:_row`;
    const existing = errorMap.get(key);
    errorMap.set(key, existing ? `${existing}; ${err.message}` : err.message);
  }

  const getRowErrors = (rowIdx: number): string[] => {
    const msgs: string[] = [];
    const rowErr = errorMap.get(`${rowIdx}:_row`);
    if (rowErr) msgs.push(rowErr);
    return msgs;
  };

  const getCellError = (rowIdx: number, colKey: string): string | undefined => {
    return errorMap.get(`${rowIdx}:${colKey}`);
  };

  const updateCell = useCallback(
    (rowIdx: number, key: string, value: unknown) => {
      const newRows = [...rows];
      newRows[rowIdx] = { ...newRows[rowIdx], [key]: value };
      onChange(newRows);
    },
    [rows, onChange],
  );

  const toggleDelete = useCallback(
    (rowIdx: number) => {
      const newRows = [...rows];
      const current = newRows[rowIdx]._delete === true;
      newRows[rowIdx] = { ...newRows[rowIdx], _delete: !current };
      onChange(newRows);
    },
    [rows, onChange],
  );

  const addRows = useCallback(
    (count: number) => {
      if (rows.length + count > MAX_ROWS) {
        return;
      }
      const newRows = Array.from({ length: count }, () => {
        const row: Record<string, unknown> = {};
        for (const col of columns) {
          row[col.key] = "";
        }
        return row;
      });
      onChange([...rows, ...newRows]);
    },
    [rows, onChange, columns],
  );

  const clearAll = useCallback(() => {
    if (!confirm("Очистить таблицу?")) return;
    onChange([]);
  }, [onChange]);

  // Paste handler
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;

      const lines = text
        .split("\n")
        .map((line) =>
          line
            .replace(/\r/g, "")
            .split("\t")
            .map((cell) =>
              cell
                .trim()
                .replace(/[\u00A0\u202F]/g, " ")
                .replace(/\u200B/g, ""),
            ),
        )
        .filter((cells) => cells.some((c) => c !== ""));

      if (lines.length === 0) return;

      // Determine target cell from active element
      const target = e.target as HTMLElement;
      const rowAttr = target.closest("[data-row]")?.getAttribute("data-row");
      const colAttr = target.closest("[data-col]")?.getAttribute("data-col");

      if (rowAttr === null || rowAttr === undefined) return;

      const startRow = parseInt(rowAttr);
      const startColIdx = colAttr ? columns.findIndex((c) => c.key === colAttr) : 0;
      if (startColIdx < 0) return;

      e.preventDefault();

      const newRows = [...rows];

      // Expand if needed
      const neededRows = startRow + lines.length;
      if (neededRows > MAX_ROWS) {
        return;
      }
      while (newRows.length < neededRows) {
        const row: Record<string, unknown> = {};
        for (const col of columns) row[col.key] = "";
        newRows.push(row);
      }

      for (let li = 0; li < lines.length; li++) {
        const rowIdx = startRow + li;
        for (let ci = 0; ci < lines[li].length; ci++) {
          const colIdx = startColIdx + ci;
          if (colIdx >= columns.length) break;
          const col = columns[colIdx];
          // Skip readonly columns for existing rows
          if (col.readonlyIfFromDb && newRows[rowIdx]._fromDb) continue;
          newRows[rowIdx] = { ...newRows[rowIdx], [col.key]: lines[li][ci] };
        }
      }

      onChange(newRows);
    },
    [rows, onChange, columns],
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => addRows(1)}
          disabled={disabled || rows.length >= MAX_ROWS}
          className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
        >
          + Строка
        </button>
        <button
          type="button"
          onClick={() => {
            const count = prompt("Сколько строк добавить?", "10");
            if (count) addRows(parseInt(count) || 0);
          }}
          disabled={disabled || rows.length >= MAX_ROWS}
          className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
        >
          + N строк
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={disabled || rows.length === 0}
          className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 text-red-600"
        >
          Очистить
        </button>
        <span className="text-xs text-gray-400 ml-auto">
          {rows.length} / {MAX_ROWS} строк
        </span>
      </div>

      {/* Table */}
      <div ref={tableRef} className="border rounded overflow-auto max-h-[calc(100vh-320px)]" onPaste={handlePaste}>
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b">
              <th className="px-2 py-1.5 text-left font-medium text-gray-500 w-8">#</th>
              <th className="px-1 py-1.5 text-center font-medium text-gray-500 w-8">
                <span title="Удалить">✕</span>
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-1.5 text-left font-medium text-gray-500"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const isDeleted = row._delete === true;
              const isFromDb = row._fromDb === true;
              const rowErrors = getRowErrors(rowIdx);
              const hasRowError = rowErrors.length > 0;

              return (
                <tr
                  key={rowIdx}
                  className={`border-b ${isDeleted ? "bg-red-50 opacity-60" : hasRowError ? "bg-red-50/30" : rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                >
                  <td className="px-2 py-0.5 text-gray-400 text-center">{rowIdx + 1}</td>
                  <td className="px-1 py-0.5 text-center">
                    <input
                      type="checkbox"
                      checked={isDeleted}
                      onChange={() => toggleDelete(rowIdx)}
                      disabled={disabled}
                      className="w-3.5 h-3.5 accent-red-500"
                      title="Пометить на удаление"
                    />
                  </td>
                  {columns.map((col) => {
                    const cellError = getCellError(rowIdx, col.key);
                    const isReadonly = (col.readonlyIfFromDb && isFromDb) || isDeleted || disabled;
                    const value = row[col.key] ?? "";

                    return (
                      <td
                        key={col.key}
                        data-row={rowIdx}
                        data-col={col.key}
                        className={`px-1 py-0.5 ${cellError ? "bg-red-100" : ""}`}
                        title={cellError || undefined}
                      >
                        {col.type === "select" && col.options ? (
                          <select
                            value={String(value)}
                            onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                            disabled={isReadonly}
                            className={`w-full px-1.5 py-1 text-xs border rounded bg-white ${
                              cellError ? "border-red-400" : "border-gray-200"
                            } ${isDeleted ? "line-through text-gray-400" : ""} ${isReadonly ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          >
                            <option value="">—</option>
                            {col.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            value={String(value)}
                            onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                            disabled={isReadonly}
                            className={`h-7 px-1.5 text-xs ${
                              cellError ? "border-red-400 focus-visible:ring-red-400" : ""
                            } ${isDeleted ? "line-through text-gray-400" : ""} ${isReadonly ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Таблица пуста. Добавьте строки или загрузите из БД.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
