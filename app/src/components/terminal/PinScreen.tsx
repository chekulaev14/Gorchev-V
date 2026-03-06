"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api, ApiError } from "@/lib/api-client";

interface PinScreenProps {
  onLogin: (workerId: string, workerName: string, role: string) => void;
}

export function PinScreen({ onLogin }: PinScreenProps) {
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
        try {
          const data = await api.post<{ id: string; name: string; role: string }>(
            "/api/terminal/auth", { pin: newPin }, { silent: true },
          );
          onLogin(data.id, data.name, data.role);
        } catch (err) {
          const msg = err instanceof ApiError ? "Неверный PIN-код" : "Ошибка связи";
          setError(msg);
          setTimeout(() => {
            setPin("");
            setError("");
          }, 1500);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <p className="text-muted-foreground text-sm mb-5">Введите PIN-код</p>

      <div className="flex gap-2 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition-all ${
              i < pin.length
                ? error
                  ? "bg-destructive border-destructive"
                  : "bg-foreground border-foreground"
                : "border-muted-foreground/50"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-destructive text-sm mb-2 animate-pulse">{error}</p>
      )}

      {loading && (
        <p className="text-muted-foreground text-sm mb-2">Проверка...</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {digits.map((digit, i) => {
          if (digit === "") return <div key={i} />;
          if (digit === "⌫") {
            return (
              <Button
                key={i}
                variant="outline"
                className="w-12 h-12 text-lg rounded-xl border-border bg-card text-muted-foreground hover:bg-accent active:bg-accent"
                onClick={handleDelete}
                disabled={loading}
              >
                ⌫
              </Button>
            );
          }
          return (
            <Button
              key={i}
              variant="outline"
              className="w-12 h-12 text-xl font-semibold rounded-xl border-border bg-card text-foreground hover:bg-accent active:bg-accent"
              onClick={() => handleDigit(digit)}
              disabled={loading}
            >
              {digit}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
