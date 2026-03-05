"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PinScreenProps {
  onLogin: (workerId: string, workerName: string) => void;
}

export function PinScreen({ onLogin }: PinScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const { workers } = require("@/data/catalog");

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError("");

      if (newPin.length === 4) {
        const worker = workers.find((w: { pin: string }) => w.pin === newPin);
        if (worker) {
          onLogin(worker.id, worker.name);
        } else {
          setError("Неверный PIN-код");
          setTimeout(() => {
            setPin("");
            setError("");
          }, 1500);
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 p-4">
      <p className="text-zinc-400 text-sm mb-5">Введите PIN-код</p>

      <div className="flex gap-2 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition-all ${
              i < pin.length
                ? error
                  ? "bg-red-500 border-red-500"
                  : "bg-white border-white"
                : "border-zinc-600"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-2 animate-pulse">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {digits.map((digit, i) => {
          if (digit === "") return <div key={i} />;
          if (digit === "⌫") {
            return (
              <Button
                key={i}
                variant="outline"
                className="w-12 h-12 text-lg rounded-xl border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-zinc-600"
                onClick={handleDelete}
              >
                ⌫
              </Button>
            );
          }
          return (
            <Button
              key={i}
              variant="outline"
              className="w-12 h-12 text-xl font-semibold rounded-xl border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700 active:bg-zinc-600"
              onClick={() => handleDigit(digit)}
            >
              {digit}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
