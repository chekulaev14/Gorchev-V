'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { NomenclatureItem, WarehouseRole, BomChildEntry, Worker } from '@/lib/types';
import { api, ApiError } from '@/lib/api-client';

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
  /** Быстрый refresh: только balances + bom (после операций, BOM-изменений) */
  refresh: () => void;
  /** Полный refresh: items + balances + bom + workers (после создания/удаления позиций) */
  refreshAll: () => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  session: WarehouseSession | null;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const WarehouseContext = createContext<WarehouseContextType | null>(null);

function parseBomMap(bomData: { parentId: string; child: NomenclatureItem; quantity: number }[]) {
  const map: Record<string, BomChildEntry[]> = {};
  for (const entry of bomData) {
    if (!map[entry.parentId]) map[entry.parentId] = [];
    map[entry.parentId].push({ item: entry.child, quantity: entry.quantity });
  }
  return map;
}

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NomenclatureItem[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [bomChildren, setBomChildren] = useState<Record<string, BomChildEntry[]>>({});
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('erp_editMode') === 'true';
    }
    return false;
  });
  const [session, setSession] = useState<WarehouseSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // --- Отдельные fetch-функции ---
  const fetchItems = useCallback(
    () =>
      api
        .get<{ items: NomenclatureItem[] }>('/api/nomenclature', { silent: true })
        .then((d) => setItems(d.items))
        .catch(() => {}),
    [],
  );

  const fetchBalances = useCallback(
    () =>
      api
        .get<{ balances: Record<string, number> }>('/api/stock', { silent: true })
        .then((d) => setBalances(d.balances))
        .catch(() => {}),
    [],
  );

  const fetchBom = useCallback(
    () =>
      api
        .get<{ parentId: string; child: NomenclatureItem; quantity: number }[]>('/api/bom', {
          silent: true,
        })
        .then((d) => setBomChildren(parseBomMap(d)))
        .catch(() => {}),
    [],
  );

  const fetchWorkers = useCallback(
    () =>
      api
        .get<Worker[]>('/api/workers', { silent: true })
        .then((d) => setWorkers(d))
        .catch(() => {}),
    [],
  );

  // Начальная загрузка: все параллельно, UI разблокируется по мере готовности items
  const fetchAll = useCallback(async () => {
    // items — главный ресурс, разблокирует UI
    const itemsPromise = fetchItems().then(() => setLoading(false));
    // остальное грузится параллельно в фоне
    fetchBalances();
    fetchBom();
    fetchWorkers();
    await itemsPromise;
  }, [fetchItems, fetchBalances, fetchBom, fetchWorkers]);

  // Быстрый refresh: только volatile данные
  const refresh = useCallback(() => {
    fetchBalances();
    fetchBom();
  }, [fetchBalances, fetchBom]);

  // Полный refresh: все данные
  const refreshAll = useCallback(() => {
    fetchItems();
    fetchBalances();
    fetchBom();
    fetchWorkers();
  }, [fetchItems, fetchBalances, fetchBom, fetchWorkers]);

  const WEB_ROLES: WarehouseRole[] = ['WAREHOUSE', 'DIRECTOR', 'ADMIN'];

  // Check existing session on mount
  useEffect(() => {
    api
      .get<{ actorId: string; name: string; role: WarehouseRole }>('/api/auth/me', { silent: true })
      .then((data) => {
        if (data && WEB_ROLES.includes(data.role)) {
          setSession({ id: data.actorId, name: data.name || '', role: data.role });
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  // Load data after auth confirmed
  useEffect(() => {
    if (authChecked && session) {
      fetchAll();
    } else if (authChecked && !session) {
      setLoading(false);
    }
  }, [authChecked, session, fetchAll]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const data = await api.post<{ id: string; name: string; role: WarehouseRole }>(
        '/api/auth/login',
        { email, password },
        { silent: true },
      );
      if (!WEB_ROLES.includes(data.role)) {
        api.post('/api/auth/logout', undefined, { silent: true }).catch(() => {});
        return 'Нет доступа к складу';
      }
      setSession({ id: data.id, name: data.name, role: data.role });
      return null;
    } catch (err) {
      if (err instanceof ApiError) return err.data.error || 'Неверный email или пароль';
      return 'Ошибка связи';
    }
  }, []);

  const handleSetEditMode = useCallback((v: boolean) => {
    setEditMode(v);
    localStorage.setItem('erp_editMode', String(v));
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setEditMode(false);
    localStorage.removeItem('erp_editMode');
    api.post('/api/auth/logout', undefined, { silent: true }).catch(() => {});
  }, []);

  return (
    <WarehouseContext.Provider
      value={{
        items,
        balances,
        bomChildren,
        workers,
        loading,
        authChecked,
        refresh,
        refreshAll,
        editMode,
        setEditMode: handleSetEditMode,
        session,
        login,
        logout,
      }}
    >
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  const ctx = useContext(WarehouseContext);
  if (!ctx) throw new Error('useWarehouse must be used within WarehouseProvider');
  return ctx;
}
