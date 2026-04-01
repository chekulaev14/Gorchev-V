'use client';

interface RoutingInput {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
}

interface RoutingStep {
  stepNo: number;
  outputItemName: string;
  outputQty: number;
  outputUnit: string;
  inputs: RoutingInput[];
}

interface Props {
  steps: RoutingStep[];
}

export function RoutingPreview({ steps }: Props) {
  if (steps.length === 0) {
    return <p className="text-muted-foreground text-xs">Маршрут не задан</p>;
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {steps.map((step, idx) => (
        <div key={step.stepNo} className="flex items-center gap-1 shrink-0">
          {step.inputs.length > 0 && (
            <>
              <div className="flex flex-col gap-0.5">
                {step.inputs.map((inp) => (
                  <div
                    key={inp.itemId}
                    className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800"
                  >
                    {inp.itemName}
                    <span className="text-amber-500 ml-1">
                      {inp.quantity} {inp.unit}
                    </span>
                  </div>
                ))}
              </div>
              <span className="text-muted-foreground text-xs">→</span>
            </>
          )}
          {step.inputs.length === 0 && idx > 0 && (
            <span className="text-muted-foreground text-xs">→</span>
          )}
          <div className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-xs text-blue-800">
            {step.outputItemName}
            <span className="text-blue-500 ml-1">×{step.outputQty}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
