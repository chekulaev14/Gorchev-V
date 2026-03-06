"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WarehouseProvider, useWarehouse } from "@/components/warehouse/WarehouseContext";
import { WarehouseNav } from "@/components/warehouse/WarehouseNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

function PinGate() {
  const { login } = useWarehouse();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDigit = async (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError("");

      if (newPin.length === 4) {
        setLoading(true);
        const err = await login(newPin);
        if (err) {
          setError(err);
          setTimeout(() => { setPin(""); setError(""); }, 1500);
        }
        setLoading(false);
      }
    }
  };

  const handleDelete = () => { setPin(pin.slice(0, -1)); setError(""); };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <p className="text-muted-foreground text-xs mb-1">Склад</p>
      <p className="text-muted-foreground text-sm mb-5">Введите PIN-код</p>

      <div className="flex gap-2 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition-all ${
              i < pin.length
                ? error ? "bg-destructive border-destructive" : "bg-foreground border-foreground"
                : "border-muted-foreground/50"
            }`}
          />
        ))}
      </div>

      {error && <p className="text-destructive text-sm mb-2 animate-pulse">{error}</p>}
      {loading && <p className="text-muted-foreground text-sm mb-2">Проверка...</p>}

      <div className="grid grid-cols-3 gap-2">
        {digits.map((digit, i) => {
          if (digit === "") return <div key={i} />;
          if (digit === "⌫") {
            return (
              <Button key={i} variant="outline" disabled={loading}
                className="w-12 h-12 text-lg rounded-xl border-border bg-card text-muted-foreground"
                onClick={handleDelete}>⌫</Button>
            );
          }
          return (
            <Button key={i} variant="outline" disabled={loading}
              className="w-12 h-12 text-xl font-semibold rounded-xl border-border bg-card text-foreground"
              onClick={() => handleDigit(digit)}>{digit}</Button>
          );
        })}
      </div>
    </div>
  );
}

function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const { loading, editMode, setEditMode, session, logout } = useWarehouse();
  const router = useRouter();

  if (!session) return <PinGate />;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-foreground text-base font-semibold">Склад</h1>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-muted-foreground text-xs">{session.name}</span>
            <Button
              variant={editMode ? "default" : "secondary"}
              size="sm"
              className="h-8 text-xs whitespace-nowrap"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? "Выйти" : "Ред."}
            </Button>
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={logout}
            >
              Выход
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <WarehouseNav />
          {editMode && (
            <div className="flex gap-1 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => router.push("/warehouse/deleted")}
              >
                Удалённые
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => router.push("/warehouse/builder")}
              >
                Конструктор изделия
              </Button>
            </div>
          )}
        </div>
      </header>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <WarehouseProvider>
      <WarehouseLayout>{children}</WarehouseLayout>
    </WarehouseProvider>
  );
}
