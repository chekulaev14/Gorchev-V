"use client";

import { SetupTable, type ColumnConfig } from "./SetupTable";
import { useSetupImport } from "./useSetupImport";
import { SetupTabActions } from "./SetupTabActions";

const columns: ColumnConfig[] = [
  { key: "parentCode", label: "Код изделия", type: "text", width: "150px" },
  { key: "componentCode", label: "Код компонента", type: "text", width: "150px" },
  { key: "qty", label: "Кол-во", type: "number", width: "100px" },
  { key: "lineNo", label: "№ строки", type: "number", width: "80px" },
];

export function BomSetupTab() {
  const hook = useSetupImport("bom");

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
