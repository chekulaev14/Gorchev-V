"use client";

import { SetupTable, type ColumnConfig } from "./SetupTable";
import { useSetupImport } from "./useSetupImport";
import { SetupTabActions } from "./SetupTabActions";

const columns: ColumnConfig[] = [
  { key: "itemCode", label: "Код изделия", type: "text", width: "130px" },
  { key: "stepNo", label: "Шаг", type: "number", width: "60px" },
  { key: "processCode", label: "Процесс", type: "text", width: "130px" },
  { key: "outputCode", label: "Выход", type: "text", width: "130px" },
  { key: "outputQty", label: "Вых. кол", type: "number", width: "80px" },
  { key: "inputCode", label: "Вход", type: "text", width: "130px" },
  { key: "inputQty", label: "Вх. кол", type: "number", width: "80px" },
  { key: "sortOrder", label: "Порядок", type: "number", width: "70px" },
];

export function RoutingSetupTab() {
  const hook = useSetupImport("routing");

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
