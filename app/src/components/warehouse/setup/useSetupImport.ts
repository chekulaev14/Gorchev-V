"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { SetupTab } from "@/lib/schemas/setup-import.schema";

// --- Types ---

export type SetupStatus = "idle" | "loading" | "loaded" | "validating" | "validated" | "saving" | "saved";

export interface SetupError {
  row: number;
  column?: string;
  message: string;
}

export interface EstimatedChanges {
  rows: { create: number; update: number; delete: number; noop: number };
  bom?: { activate: number; archive: number };
  routing?: { activate: number; archive: number };
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  deleteRows: number;
}

interface ValidateResponse {
  valid: boolean;
  errors: SetupError[];
  summary: ValidationSummary;
  estimatedChanges: EstimatedChanges;
}

interface ImportResponse {
  success: boolean;
  imported: number;
  updated: number;
  deleted: number;
  skipped: number;
}

interface LoadResponse {
  rows: Record<string, unknown>[];
}

// --- Hook ---

export function useSetupImport(tab: SetupTab) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [errors, setErrors] = useState<SetupError[]>([]);
  const [status, setStatus] = useState<SetupStatus>("idle");
  const [isDirty, setIsDirty] = useState(false);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [estimatedChanges, setEstimatedChanges] = useState<EstimatedChanges | null>(null);

  const statusRef = useRef(status);
  statusRef.current = status;

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleLoad = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await api.get<LoadResponse>(`/api/setup/load?tab=${tab}`);
      const loaded = data.rows.map((r) => ({ ...r, _fromDb: true }));
      setRows(loaded);
      setErrors([]);
      setSummary(null);
      setEstimatedChanges(null);
      setIsDirty(false);
      setStatus("loaded");
    } catch {
      setStatus("idle");
    }
  }, [tab]);

  const handleValidate = useCallback(async () => {
    if (rows.length === 0) {
      toast.error("Таблица пуста");
      return;
    }

    setStatus("validating");
    try {
      // Strip _fromDb before sending
      const cleanRows = rows.map((r) => {
        const { _fromDb, ...rest } = r;
        return rest;
      });

      const data = await api.post<ValidateResponse>(
        "/api/setup/validate",
        { tab, rows: cleanRows },
        { silent: true },
      );

      setErrors(data.errors);
      setSummary(data.summary);
      setEstimatedChanges(data.estimatedChanges);
      setStatus("validated");

      if (data.valid) {
        toast.success("Проверка пройдена");
      } else {
        toast.error(`Найдено ошибок: ${data.errors.length}`);
      }
    } catch (err) {
      setStatus("idle");
      if (err instanceof Error) {
        toast.error(err.message);
      }
    }
  }, [rows, tab]);

  const handleSave = useCallback(async () => {
    if (rows.length === 0) return;

    setStatus("saving");
    try {
      const cleanRows = rows.map((r) => {
        const { _fromDb, ...rest } = r;
        return rest;
      });

      const data = await api.post<ImportResponse>(
        "/api/setup/import",
        { tab, rows: cleanRows },
        { silent: true },
      );

      setStatus("saved");
      setIsDirty(false);
      setErrors([]);
      setSummary(null);
      setEstimatedChanges(null);

      const parts: string[] = [];
      if (data.imported > 0) parts.push(`Создано: ${data.imported}`);
      if (data.updated > 0) parts.push(`Обновлено: ${data.updated}`);
      if (data.deleted > 0) parts.push(`Удалено: ${data.deleted}`);
      if (data.skipped > 0) parts.push(`Пропущено: ${data.skipped}`);
      toast.success(parts.join(", ") || "Готово");

      // Clear rows after save
      setRows([]);
    } catch (err) {
      setStatus("validated");
      if (err instanceof Error) {
        toast.error(err.message);
      }
    }
  }, [rows, tab]);

  const updateRows = useCallback((newRows: Record<string, unknown>[]) => {
    setRows(newRows);
    setIsDirty(true);
    // Reset validation when rows change after validation
    if (statusRef.current === "validated" || statusRef.current === "saved") {
      setStatus("idle");
      setErrors([]);
      setSummary(null);
      setEstimatedChanges(null);
    }
  }, []);

  return {
    rows,
    setRows: updateRows,
    errors,
    status,
    isDirty,
    summary,
    estimatedChanges,
    handleLoad,
    handleValidate,
    handleSave,
  };
}
