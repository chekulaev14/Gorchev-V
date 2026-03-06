"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { NomenclatureItem, WarehouseRole, BomChildEntry, Worker } from "@/lib/types";
import { api, ApiError } from "@/lib/api-client";

export type { WarehouseRole };

interface WarehouseSession {
  id: string;
  name: string;
  role: WarehouseRole;
}

interface WarehouseContextType {
  items: NomenclatureItem[];
  balances: Record<string, number>;
  bomChildren: Record<string, BomChildEntry[]>;
  workers: Worker[];
  loading: boolean;
  authChecked: boolean;
  refresh: () => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  session: WarehouseSession | null;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const WarehouseContext = createContext<WarehouseContextType | null>(null);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NomenclatureItem[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [bomChildren, setBomChildren] = useState<Record<string, BomChildEntry[]>>({});
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [session, setSession] = useState<WarehouseSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [nomData, stockData, bomData, workersData] = await Promise.all([
        api.get<{ items: NomenclatureItem[] }>("/api/nomenclature", { silent: true }),
        api.get<{ balances: Record<string, number> }>("/api/stock", { silent: true }),
        api.get<{ parentId: string; child: NomenclatureItem; quantity: number }[]>("/api/bom", { silent: true }),
        api.get<Worker[]>("/api/workers", { silent: true }),
      ]);

      setItems(nomData.items);
      setBalances(stockData.balances);
      setWorkers(workersData);

      const map: Record<string, BomChildEntry[]> = {};
      for (const entry of bomData) {
        if (!map[entry.parentId]) map[entry.parentId] = [];
        map[entry.parentId].push({ item: entry.child, quantity: entry.quantity });
      }
      setBomChildren(map);
    } catch {
      // silent — toast не нужен при загрузке
    } finally {
      setLoading(false);
    }
  }, []);

  const WEB_ROLES: WarehouseRole[] = ["WAREHOUSE", "DIRECTOR", "ADMIN"];

  // Check existing session on mount
  useEffect(() => {
    api.get<{ actorId: string; name: string; role: WarehouseRole }>("/api/auth/me", { silent: true })
      .then((data) => {
        if (data && WEB_ROLES.includes(data.role)) {
          setSession({ id: data.actorId, name: data.name || "", role: data.role });
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  // Load data after auth confirmed
  useEffect(() => {
    if (authChecked && session) {
      fetchData();
    } else if (authChecked && !session) {
      setLoading(false);
    }
  }, [authChecked, session, fetchData]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const data = await api.post<{ id: string; name: string; role: WarehouseRole }>(
        "/api/auth/login", { email, password }, { silent: true },
      );
      if (!WEB_ROLES.includes(data.role)) {
        api.post("/api/auth/logout", undefined, { silent: true }).catch(() => {});
        return "Нет доступа к складу";
      }
      setSession({ id: data.id, name: data.name, role: data.role });
      return null;
    } catch (err) {
      if (err instanceof ApiError) return err.data.error || "Неверный email или пароль";
      return "Ошибка связи";
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setEditMode(false);
    api.post("/api/auth/logout", undefined, { silent: true }).catch(() => {});
  }, []);

  return (
    <WarehouseContext.Provider value={{
      items, balances, bomChildren, workers, loading, authChecked, refresh: fetchData,
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
