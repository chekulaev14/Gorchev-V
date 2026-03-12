"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

interface WorkerEntry {
  workerId: string;
  workerName: string;
  quantity: number;
}

interface WorkersStepProps {
  partName: string;
  currentWorker: { workerId: string; workerName: string };
  initialQuantity: number;
  pricePerUnit: number;
  onSubmit: (workers: { workerId: string; quantity: number }[]) => Promise<string | null>;
  onBack: () => void;
}

export function WorkersStep({
  partName,
  currentWorker,
  initialQuantity,
  pricePerUnit,
  onSubmit,
  onBack,
}: WorkersStepProps) {
  const [workers, setWorkers] = useState<WorkerEntry[]>([
    { ...currentWorker, quantity: initialQuantity },
  ]);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinPad, setShowPinPad] = useState(false);
  const [partnerQty, setPartnerQty] = useState("");
  const [pendingPartner, setPendingPartner] = useState<{ workerId: string; workerName: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalQty = workers.reduce((s, w) => s + w.quantity, 0);
  const totalPay = totalQty * pricePerUnit;

  const handlePinDigit = (digit: string) => {
    if (pinInput.length < 4) {
      const newPin = pinInput + digit;
      setPinInput(newPin);
      setPinError(null);

      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handlePinDelete = () => {
    setPinInput((p) => p.slice(0, -1));
    setPinError(null);
  };

  const verifyPin = async (pin: string) => {
    try {
      const data = await api.post<{ workerId: string; name: string }>(
        "/api/terminal/auth",
        { pin },
        { silent: true },
      );

      // Проверить что этот рабочий ещё не добавлен
      if (workers.some((w) => w.workerId === data.workerId)) {
        setPinError("Этот рабочий уже добавлен");
        setPinInput("");
        return;
      }

      setPendingPartner({ workerId: data.workerId, workerName: data.name });
      setShowPinPad(false);
      setPinInput("");
      setPartnerQty("");
    } catch (err) {
      setPinError(err instanceof ApiError ? (err.data.error || "Неверный PIN") : "Ошибка");
      setPinInput("");
    }
  };

  const handleAddPartner = () => {
    if (!pendingPartner || !partnerQty) return;
    const qty = parseInt(partnerQty);
    if (qty <= 0) return;

    setWorkers((prev) => [...prev, { ...pendingPartner, quantity: qty }]);
    setPendingPartner(null);
    setPartnerQty("");
  };

  const handleRemoveWorker = (workerId: string) => {
    if (workerId === currentWorker.workerId) return; // нельзя убрать себя
    setWorkers((prev) => prev.filter((w) => w.workerId !== workerId));
  };

  const handleSubmitAll = async () => {
    setSending(true);
    setSubmitError(null);
    const err = await onSubmit(workers.map((w) => ({ workerId: w.workerId, quantity: w.quantity })));
    setSending(false);
    if (err) {
      setSubmitError(err);
      setTimeout(() => setSubmitError(null), 3000);
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md space-y-3">
        <div className="bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 rounded-lg p-4 text-center">
          <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Данные отправлены</p>
          <p className="text-emerald-500/70 text-xs mt-1">{partName} — {totalQty} шт</p>
          {workers.map((w) => (
            <p key={w.workerId} className="text-emerald-500/60 text-xs mt-0.5">
              {w.workerName}: {w.quantity} шт {pricePerUnit > 0 ? `= ${w.quantity * pricePerUnit} ₽` : ""}
            </p>
          ))}
        </div>
        <Button variant="outline" className="w-full h-9" onClick={onBack}>
          Назад
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-3">
      <div className="bg-card rounded-lg p-3 border border-border">
        <h3 className="text-sm font-medium text-foreground mb-2">{partName}</h3>
        <p className="text-xs text-muted-foreground mb-3">Групповая операция — укажите участников</p>

        {/* Список рабочих */}
        <div className="space-y-1.5 mb-3">
          {workers.map((w) => (
            <div key={w.workerId} className="flex items-center gap-2 bg-background rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-foreground flex-1">{w.workerName}</span>
              <span className="text-sm text-muted-foreground">{w.quantity} шт</span>
              {pricePerUnit > 0 && (
                <span className="text-xs text-emerald-600">{w.quantity * pricePerUnit} ₽</span>
              )}
              {w.workerId !== currentWorker.workerId && (
                <button
                  type="button"
                  onClick={() => handleRemoveWorker(w.workerId)}
                  className="text-red-400 hover:text-red-600 text-xs ml-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Итого */}
        <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 mb-3">
          <span className="text-xs text-muted-foreground">Итого:</span>
          <span className="text-sm font-semibold text-foreground">{totalQty} шт</span>
          {totalPay > 0 && (
            <span className="text-xs text-emerald-600">{totalPay} ₽</span>
          )}
        </div>

        {/* Добавление напарника — PIN ввод */}
        {showPinPad && (
          <div className="bg-background rounded-lg p-3 mb-3 border border-dashed border-border">
            <p className="text-xs text-muted-foreground mb-2">PIN напарника:</p>
            <div className="flex justify-center gap-2 mb-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`w-8 h-8 rounded-lg border flex items-center justify-center text-lg font-bold ${
                  pinInput[i] ? "border-foreground text-foreground" : "border-border text-transparent"
                }`}>
                  {pinInput[i] ? "●" : "○"}
                </div>
              ))}
            </div>
            {pinError && <p className="text-xs text-destructive text-center mb-2">{pinError}</p>}
            <div className="grid grid-cols-3 gap-1">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => {
                if (d === "") return <div key={i} />;
                if (d === "⌫") return (
                  <Button key={i} variant="outline" className="h-8 text-sm" onClick={handlePinDelete}>⌫</Button>
                );
                return (
                  <Button key={i} variant="outline" className="h-8 text-sm font-semibold" onClick={() => handlePinDigit(d)}>{d}</Button>
                );
              })}
            </div>
            <Button variant="ghost" className="w-full mt-2 h-7 text-xs text-muted-foreground" onClick={() => { setShowPinPad(false); setPinInput(""); setPinError(null); }}>
              Отмена
            </Button>
          </div>
        )}

        {/* Ввод количества для подтверждённого напарника */}
        {pendingPartner && (
          <div className="bg-background rounded-lg p-3 mb-3 border border-dashed border-blue-300">
            <p className="text-xs text-muted-foreground mb-1">Рабочий: <span className="font-medium text-foreground">{pendingPartner.workerName}</span></p>
            <p className="text-xs text-muted-foreground mb-2">Количество:</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={partnerQty}
                onChange={(e) => setPartnerQty(e.target.value)}
                className="flex-1 h-8 text-center text-sm font-medium border border-input rounded-lg px-2 bg-card"
                min={1}
                placeholder="0"
                autoFocus
              />
              <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-500 text-white" onClick={handleAddPartner} disabled={!partnerQty || parseInt(partnerQty) <= 0}>
                Добавить
              </Button>
            </div>
            <Button variant="ghost" className="w-full mt-2 h-7 text-xs text-muted-foreground" onClick={() => setPendingPartner(null)}>
              Отмена
            </Button>
          </div>
        )}

        {/* Кнопки */}
        {!showPinPad && !pendingPartner && (
          <Button
            variant="outline"
            className="w-full h-8 text-xs mb-2 border-dashed"
            onClick={() => setShowPinPad(true)}
          >
            + Добавить напарника
          </Button>
        )}

        {submitError && (
          <div className="bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg p-2 text-center mb-2">
            <p className="text-destructive text-xs">{submitError}</p>
          </div>
        )}

        <Button
          className="w-full h-9 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30"
          disabled={sending || showPinPad || !!pendingPartner}
          onClick={handleSubmitAll}
        >
          {sending ? "Отправка..." : "Подтвердить"}
        </Button>
      </div>

      <Button variant="ghost" className="w-full h-8 text-xs text-muted-foreground" onClick={onBack}>
        Назад
      </Button>
    </div>
  );
}
