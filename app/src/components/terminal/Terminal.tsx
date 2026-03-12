"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PinScreen } from "./PinScreen";
import { CatalogScreen } from "./CatalogScreen";
import { api, ApiError } from "@/lib/api-client";

const INACTIVITY_TIMEOUT = 60_000; // 60 секунд

export function Terminal() {
  const router = useRouter();
  const [session, setSession] = useState<{
    workerId: string;
    workerName: string;
  } | null>(null);
  const [lastActivity, setLastActivity] = useState(() => Date.now());

  const resetActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
    api.post("/api/auth/logout", undefined, { silent: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        handleLogout();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session, lastActivity, handleLogout]);

  useEffect(() => {
    if (!session) return;
    const events = ["touchstart", "mousedown", "keydown", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetActivity));
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetActivity));
    };
  }, [session, resetActivity]);

  const handleLogin = (workerId: string, workerName: string, role: string) => {
    if (role === "DIRECTOR" || role === "WAREHOUSE") {
      router.push("/warehouse");
      return;
    }
    setSession({ workerId, workerName });
    resetActivity();
  };

  /** Отправка через /api/terminal/produce с поддержкой нескольких рабочих */
  const handleSubmit = async (
    partId: string,
    _partName: string,
    workers: { workerId: string; quantity: number }[],
  ): Promise<string | null> => {
    resetActivity();
    try {
      const clientOperationKey = `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await api.post("/api/terminal/produce", {
        itemId: partId,
        workers,
        clientOperationKey,
      }, { silent: true });
      return null;
    } catch (err) {
      if (err instanceof ApiError) return err.data.error || "Ошибка отправки";
      return "Ошибка связи с сервером";
    }
  };

  if (!session) {
    return <PinScreen onLogin={handleLogin} />;
  }

  return (
    <CatalogScreen
      workerName={session.workerName}
      workerId={session.workerId}
      onLogout={handleLogout}
      onSubmit={handleSubmit}
    />
  );
}
