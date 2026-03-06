"use client";

import { useState } from "react";
import type { Part } from "./types";
import { Button } from "@/components/ui/button";

interface PartDetailProps {
  part: Part;
  onSubmit: (quantity: number) => Promise<string | null>;
}

export function PartDetail({ part, onSubmit }: PartDetailProps) {
  const [currentImage, setCurrentImage] = useState(0);
  const [quantity, setQuantity] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleDigit = (digit: string) => {
    if (quantity.length < 5) {
      setQuantity(quantity + digit);
    }
  };

  const handleDelete = () => {
    setQuantity(quantity.slice(0, -1));
  };

  const handleSubmit = async () => {
    const num = parseInt(quantity);
    if (num > 0) {
      setSending(true);
      setError(null);
      const err = await onSubmit(num);
      setSending(false);
      if (err) {
        setError(err);
        setTimeout(() => {
          setError(null);
        }, 3000);
      } else {
        setSubmitted(true);
        setTimeout(() => {
          setQuantity("");
          setSubmitted(false);
        }, 2000);
      }
    }
  };

  const total = parseInt(quantity || "0") * part.pricePerUnit;

  return (
    <div className="space-y-3 max-w-md">
      <div className="relative bg-card rounded-lg overflow-hidden border border-border">
        <div className="aspect-[4/3] relative">
          <img
            src={part.images[currentImage]}
            alt={part.name}
            className="w-full h-full object-cover"
          />
          {part.images.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {part.images.map((_, i) => (
                <button
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentImage ? "bg-white" : "bg-foreground/40"
                  }`}
                  onClick={() => setCurrentImage(i)}
                />
              ))}
            </div>
          )}
        </div>
        {part.images.length > 1 && (
          <>
            <button
              className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white text-sm flex items-center justify-center"
              onClick={() =>
                setCurrentImage((currentImage - 1 + part.images.length) % part.images.length)
              }
            >
              ‹
            </button>
            <button
              className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white text-sm flex items-center justify-center"
              onClick={() =>
                setCurrentImage((currentImage + 1) % part.images.length)
              }
            >
              ›
            </button>
          </>
        )}
      </div>

      <div className="bg-card rounded-lg p-2.5 border border-border">
        <h2 className="text-foreground text-sm font-medium mb-0.5">{part.name}</h2>
        <p className="text-muted-foreground text-xs">{part.description}</p>
        {part.pricePerUnit > 0 && (
          <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1">Оплата за 1 ед.: {part.pricePerUnit} ₽</p>
        )}
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg p-3 text-center">
          <p className="text-destructive text-sm font-medium">{error}</p>
        </div>
      )}

      {submitted ? (
        <div className="bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 rounded-lg p-3 text-center">
          <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Данные отправлены</p>
          {total > 0 && (
            <p className="text-emerald-500 dark:text-emerald-300/70 text-xs mt-0.5">
              {quantity} шт × {part.pricePerUnit} ₽ = {total} ₽
            </p>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-lg p-3 border border-border">
          <p className="text-muted-foreground text-xs mb-2">Количество сделанных деталей:</p>

          <div className="bg-background rounded-lg px-3 py-2 mb-3 text-center min-h-[36px] flex items-center justify-center">
            {quantity ? (
              <div>
                <span className="text-foreground text-2xl font-bold">{quantity}</span>
                <span className="text-muted-foreground/70 text-sm ml-1.5">шт</span>
                {total > 0 && (
                  <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">= {total} ₽</p>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground/50 text-lg">0</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
              (digit, i) => {
                if (digit === "") return <div key={i} />;
                if (digit === "⌫") {
                  return (
                    <Button
                      key={i}
                      variant="outline"
                      className="h-9 text-base rounded-lg border-border bg-background text-muted-foreground hover:bg-accent"
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
                    className="h-9 text-lg font-semibold rounded-lg border-border bg-background text-foreground hover:bg-accent"
                    onClick={() => handleDigit(digit)}
                  >
                    {digit}
                  </Button>
                );
              }
            )}
          </div>

          <Button
            className="w-full h-9 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30"
            disabled={!quantity || parseInt(quantity) === 0 || sending}
            onClick={handleSubmit}
          >
            {sending ? "Отправка..." : "Отправить"}
          </Button>
        </div>
      )}
    </div>
  );
}
