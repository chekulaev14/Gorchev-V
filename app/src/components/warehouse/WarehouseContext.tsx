"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { NomenclatureItem } from "@/data/nomenclature";

export type WarehouseRole = "warehouse" | "director";

interface WarehouseSession {
  id: string;
  name: string;
  role: WarehouseRole;
}

interface WarehouseContextType {
  items: NomenclatureItem[];
  balances: Record<string, number>;
  loading: boolean;
  refresh: () => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  session: WarehouseSession | null;
  login: (pin: string) => Promise<string | null>;
  logout: () => void;
}

const WarehouseContext = createContext<WarehouseContextType | null>(null);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NomenclatureItem[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [session, setSession] = useState<WarehouseSession | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [nomRes, stockRes] = await Promise.all([
        fetch("/api/nomenclature"),
        fetch("/api/stock"),
      ]);
      const nomData = await nomRes.json();
      const stockData = await stockRes.json();
      setItems(nomData.items);
      setBalances(stockData.balances);
    } catch (e) {
      console.error("Ошибка загрузки данных:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const login = useCallback(async (pin: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/terminal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) return "Неверный PIN-код";
      const data = await res.json();
      if (data.role !== "warehouse" && data.role !== "director") {
        return "Нет доступа к складу";
      }
      setSession({ id: data.id, name: data.name, role: data.role });
      return null;
    } catch {
      return "Ошибка связи";
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setEditMode(false);
  }, []);

  return (
    <WarehouseContext.Provider value={{
      items, balances, loading, refresh: fetchData,
      editMode, setEditMode,
      session, login, logout,
    }}>
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  const ctx = useContext(WarehouseContext);
  if (!ctx) throw new Error("useWarehouse must be used within WarehouseProvider");
  return ctx;
}
