"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { itemTypeLabels, typeColors } from "@/lib/constants";
import type { NomenclatureItem } from "@/lib/types";
import type { RoutingData, ProcessGroup, StepPayload } from "./RoutingConstructor";

interface EditInput {
  itemId: string;
  qty: number;
}

interface EditStep {
  processId: string;
  outputItemId: string;
  outputQty: number;
  inputs: EditInput[];
}

interface Props {
  item: NomenclatureItem;
  allItems: NomenclatureItem[];
  routings: RoutingData[];
  processes: ProcessGroup[];
  loading: boolean;
  onCreateRouting: (steps: StepPayload[]) => void;
  onUpdateSteps: (routingId: string, steps: StepPayload[]) => void;
  onActivate: (routingId: string) => void;
  onDelete: (routingId: string) => void;
}

function stepsToEdit(routing: RoutingData): EditStep[] {
  return routing.steps.map((s) => ({
    processId: s.processId,
    outputItemId: s.outputItemId,
    outputQty: s.outputQty,
    inputs: s.inputs.map((inp) => ({ itemId: inp.itemId, qty: inp.qty })),
  }));
}

function editToPayload(steps: EditStep[]): StepPayload[] {
  return steps.map((s, i) => ({
    stepNo: i + 1,
    processId: s.processId,
    outputItemId: s.outputItemId,
    outputQty: s.outputQty,
    inputs: s.inputs.map((inp, j) => ({ itemId: inp.itemId, qty: inp.qty, sortOrder: j })),
  }));
}

const emptyStep = (): EditStep => ({
  processId: "",
  outputItemId: "",
  outputQty: 1,
  inputs: [],
});

export function RoutingEditor({ item, allItems, routings, processes, loading, onCreateRouting, onUpdateSteps, onActivate, onDelete }: Props) {
  const [steps, setSteps] = useState<EditStep[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const draft = routings.find((r) => r.status === "DRAFT");
  const active = routings.find((r) => r.status === "ACTIVE");

  useEffect(() => {
    if (draft) {
      setSteps(stepsToEdit(draft));
    } else if (active) {
      setSteps(stepsToEdit(active));
    } else {
      setSteps([]);
    }
    setIsDirty(false);
  }, [routings, item.id]);

  const allProcesses = processes.flatMap((g) => g.processes);

  // Все outputItemIds в текущих шагах (для исключения из выбора)
  const usedOutputIds = new Set(steps.map((s) => s.outputItemId).filter(Boolean));

  const handleAddStep = () => {
    setSteps([...steps, emptyStep()]);
    setIsDirty(true);
  };

  const handleRemoveStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const updateStep = (idx: number, patch: Partial<EditStep>) => {
    setSteps(steps.map((s, i) => i === idx ? { ...s, ...patch } : s));
    setIsDirty(true);
  };

  const handleAddInput = (stepIdx: number, itemId: string | null) => {
    if (!itemId) return;
    const step = steps[stepIdx];
    updateStep(stepIdx, { inputs: [...step.inputs, { itemId, qty: 1 }] });
  };

  const handleRemoveInput = (stepIdx: number, inputIdx: number) => {
    const step = steps[stepIdx];
    updateStep(stepIdx, { inputs: step.inputs.filter((_, i) => i !== inputIdx) });
  };

  const handleInputQtyChange = (stepIdx: number, inputIdx: number, value: string) => {
    const qty = Number(value);
    if (isNaN(qty)) return;
    const step = steps[stepIdx];
    updateStep(stepIdx, {
      inputs: step.inputs.map((inp, i) => i === inputIdx ? { ...inp, qty } : inp),
    });
  };

  const handleSave = () => {
    const payload = editToPayload(steps);
    if (draft) {
      onUpdateSteps(draft.id, payload);
    } else {
      onCreateRouting(payload);
    }
    setIsDirty(false);
  };

  const handleActivate = () => {
    if (draft) onActivate(draft.id);
  };

  const handleDelete = () => {
    if (draft) onDelete(draft.id);
  };

  const isEditable = !active || !!draft; // можно редактировать если нет active или есть draft

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">{item.name}</h2>
          <Badge variant="outline" className={`text-xs px-2 py-0.5 ${typeColors[item.type]}`}>
            {itemTypeLabels[item.type]}
          </Badge>
          {draft && <Badge className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5">Черновик v{draft.version}</Badge>}
          {active && <Badge className="bg-green-100 text-green-800 text-xs px-2 py-0.5">Активный v{active.version}</Badge>}
        </div>
        <div className="flex gap-2">
          {isDirty && steps.length > 0 && (
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
              Сохранить
            </Button>
          )}
          {draft && !isDirty && draft.steps.length > 0 && (
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={handleActivate}>
              Активировать
            </Button>
          )}
          {draft && (
            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={handleDelete}>
              Удалить черновик
            </Button>
          )}
        </div>
      </div>

      {/* Шаги */}
      {steps.length === 0 ? (
        <div className="border border-border rounded-lg bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">Маршрут пуст</p>
          <Button variant="outline" size="sm" onClick={handleAddStep}>
            + Добавить шаг
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, stepIdx) => {
            const usedInputIds = new Set(step.inputs.map((inp) => inp.itemId));
            const availableInputItems = allItems.filter(
              (i) => i.id !== step.outputItemId && !usedInputIds.has(i.id),
            );

            return (
              <div key={stepIdx} className="border border-border rounded-lg bg-card">
                {/* Step header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">Шаг {stepIdx + 1}</span>

                  {/* Process select */}
                  <SearchableSelect
                    items={allProcesses}
                    value={step.processId || null}
                    onChange={(id) => updateStep(stepIdx, { processId: id ?? "" })}
                    getKey={(p) => p.id}
                    getLabel={(p) => p.name}
                    placeholder="Процесс..."
                    className="text-xs w-40"
                  />

                  <span className="text-xs text-muted-foreground ml-auto mr-1">→</span>

                  {/* Output item */}
                  <SearchableSelect
                    items={allItems.filter((i) => i.id !== item.id || stepIdx === steps.length - 1 ? true : !usedOutputIds.has(i.id) || i.id === step.outputItemId)}
                    value={step.outputItemId || null}
                    onChange={(id) => updateStep(stepIdx, { outputItemId: id ?? "" })}
                    getKey={(i) => i.id}
                    getLabel={(i) => `${i.name} (${i.code})`}
                    filterFn={(i, q) => { const lq = q.toLowerCase(); return i.name.toLowerCase().includes(lq) || i.code.toLowerCase().includes(lq); }}
                    placeholder="Выход..."
                    className="text-xs w-48"
                  />

                  <Input
                    type="number"
                    min={0.0001}
                    step="any"
                    value={step.outputQty}
                    onChange={(e) => updateStep(stepIdx, { outputQty: Number(e.target.value) || 1 })}
                    className="h-7 text-xs w-20"
                    title="Кол-во выхода"
                  />

                  <button
                    className="text-destructive hover:text-destructive/80 text-sm ml-1"
                    onClick={() => handleRemoveStep(stepIdx)}
                    title="Удалить шаг"
                  >
                    ✕
                  </button>
                </div>

                {/* Inputs */}
                <div className="px-3 py-2 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Входы</span>
                  {step.inputs.length === 0 && (
                    <p className="text-xs text-muted-foreground">Нет входов</p>
                  )}
                  {step.inputs.map((inp, inpIdx) => {
                    const comp = allItems.find((i) => i.id === inp.itemId);
                    return (
                      <div key={inp.itemId} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {comp && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[comp.type]}`}>
                              {itemTypeLabels[comp.type]}
                            </Badge>
                          )}
                          <span className="text-xs text-foreground truncate">{comp?.name ?? inp.itemId}</span>
                        </div>
                        <Input
                          type="number"
                          min={0.0001}
                          step="any"
                          value={inp.qty}
                          onChange={(e) => handleInputQtyChange(stepIdx, inpIdx, e.target.value)}
                          className="h-6 text-xs w-20"
                        />
                        <button
                          className="text-destructive hover:text-destructive/80 text-xs"
                          onClick={() => handleRemoveInput(stepIdx, inpIdx)}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}

                  <SearchableSelect
                    items={availableInputItems}
                    value={null}
                    onChange={(id) => handleAddInput(stepIdx, id)}
                    getKey={(i) => i.id}
                    getLabel={(i) => `${i.name} (${i.code})`}
                    filterFn={(i, q) => { const lq = q.toLowerCase(); return i.name.toLowerCase().includes(lq) || i.code.toLowerCase().includes(lq); }}
                    placeholder="+ Добавить вход..."
                    className="text-xs"
                  />
                </div>
              </div>
            );
          })}

          {isEditable && (
            <Button variant="outline" size="sm" className="w-full" onClick={handleAddStep}>
              + Добавить шаг
            </Button>
          )}
        </div>
      )}

      {/* История */}
      {routings.length > 1 && (
        <div>
          <h3 className="text-xs text-muted-foreground font-medium mb-2">История маршрутов</h3>
          <div className="space-y-1">
            {routings.filter((r) => r.id !== draft?.id).map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs px-3 py-1.5 bg-card border border-border rounded">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${r.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                  {r.status === "ACTIVE" ? "Активный" : "Архив"}
                </Badge>
                <span className="text-muted-foreground">v{r.version}</span>
                <span className="text-muted-foreground">— {r.steps.length} шаг.</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
