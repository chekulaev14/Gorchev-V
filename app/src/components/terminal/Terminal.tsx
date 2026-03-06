"use client";

import { useState, useEffect, useCallback } from "react";
import { PinScreen } from "./PinScreen";
import { CatalogScreen } from "./CatalogScreen";

const INACTIVITY_TIMEOUT = 60_000; // 60 секунд

export function Terminal() {
  const [session, setSession] = useState<{
    workerId: string;
    workerName: string;
  } | null>(null);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const resetActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
  }, []);

  // Автовыход по таймауту бездействия
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        handleLogout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, lastActivity, handleLogout]);

  // Отслеживание активности
  useEffect(() => {
    if (!session) return;

    const events = ["touchstart", "mousedown", "keydown", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetActivity));
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetActivity));
    };
  }, [session, resetActivity]);

  const handleLogin = (workerId: string, workerName: string) => {
    setSession({ workerId, workerName });
    resetActivity();
  };

  const handleSubmit = async (
    partId: string,
    partName: string,
    quantity: number,
    pricePerUnit: number
  ) => {
    resetActivity();
    try {
      await fetch("/api/terminal/output", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: session?.workerId,
          itemId: partId,
          itemName: partName,
          quantity,
          pricePerUnit,
        }),
      });
    } catch (err) {
      console.error("Ошибка отправки выработки:", err);
    }
  };

  if (!session) {
    return <PinScreen onLogin={handleLogin} />;
  }

  return (
    <CatalogScreen
      workerName={session.workerName}
      onLogout={handleLogout}
      onSubmit={handleSubmit}
    />
  );
}
