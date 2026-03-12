"use client";

import { SetupTable, type ColumnConfig } from "./SetupTable";
import { useSetupImport } from "./useSetupImport";
import { SetupTabActions } from "./SetupTabActions";

const columns: ColumnConfig[] = [
  { key: "itemCode", label: "Код позиции", type: "text", width: "150px" },
  { key: "qty", label: "Кол-во", type: "number", width: "120px" },
  {
    key: "mode",
    label: "Режим",
    type: "select",
    width: "130px",
    options: [
      { value: "income", label: "Приход" },
      { value: "set", label: "Установить" },
    ],
  },
];

export function StockSetupTab() {
  const hook = useSetupImport("stock");

  return (
    <div className="space-y-3">
      <SetupTabActions hook={hook} />
      <SetupTable
        columns={columns}
        rows={hook.rows}
        errors={hook.errors}
        onChange={hook.setRows}
        disabled={hook.status === "saving" || hook.status === "validating"}
      />
    </div>
  );
}
