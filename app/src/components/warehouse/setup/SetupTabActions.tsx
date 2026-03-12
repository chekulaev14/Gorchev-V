"use client";

import { Button } from "@/components/ui/button";
import type { useSetupImport } from "./useSetupImport";

interface Props {
  hook: ReturnType<typeof useSetupImport>;
}

export function SetupTabActions({ hook }: Props) {
  const { status, isDirty, rows, summary, estimatedChanges, handleLoad, handleValidate, handleSave } = hook;

  const isLoading = status === "loading";
  const isValidating = status === "validating";
  const isSaving = status === "saving";
  const isBusy = isLoading || isValidating || isSaving;
  const isValidated = status === "validated";
  const hasErrors = isValidated && (summary?.errorRows ?? 0) > 0;
  const canSave = isValidated && !hasErrors;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (rows.length > 0 && isDirty) {
              if (!confirm("Текущие данные будут заменены. Продолжить?")) return;
            }
            handleLoad();
          }}
          disabled={isBusy}
        >
          {isLoading ? "Загрузка..." : "Загрузить из БД"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleValidate}
          disabled={isBusy || rows.length === 0}
        >
          {isValidating ? "Проверка..." : "Проверить"}
        </Button>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={isBusy || !canSave}
        >
          {isSaving ? "Сохранение..." : "Сохранить"}
        </Button>

        {isDirty && (
          <span className="text-xs text-amber-600">Есть несохранённые изменения</span>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <span className="text-gray-500">
            Проверено: {summary.totalRows}, корректных: {summary.validRows}, ошибок:{" "}
            <span className={summary.errorRows > 0 ? "text-red-600 font-medium" : ""}>
              {summary.errorRows}
            </span>
            {summary.deleteRows > 0 && <>, на удаление: {summary.deleteRows}</>}
          </span>

          {estimatedChanges && (
            <span className="text-gray-400">
              |{" "}
              {estimatedChanges.rows.create > 0 && (
                <span className="text-green-600">+{estimatedChanges.rows.create} </span>
              )}
              {estimatedChanges.rows.update > 0 && (
                <span className="text-blue-600">~{estimatedChanges.rows.update} </span>
              )}
              {estimatedChanges.rows.delete > 0 && (
                <span className="text-red-600">-{estimatedChanges.rows.delete} </span>
              )}
              {estimatedChanges.rows.noop > 0 && (
                <span className="text-gray-400">={estimatedChanges.rows.noop}</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
