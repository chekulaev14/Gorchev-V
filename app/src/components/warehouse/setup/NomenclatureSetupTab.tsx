"use client";

import { SetupTable, type ColumnConfig } from "./SetupTable";
import { useSetupImport } from "./useSetupImport";
import { SetupTabActions } from "./SetupTabActions";

const columns: ColumnConfig[] = [
  { key: "code", label: "Код", type: "text", readonlyIfFromDb: true, width: "120px" },
  { key: "name", label: "Название", type: "text", width: "250px" },
  {
    key: "type",
    label: "Тип",
    type: "select",
    width: "130px",
    options: [
      { value: "material", label: "Сырьё" },
      { value: "blank", label: "Заготовка" },
      { value: "product", label: "Изделие" },
    ],
  },
  {
    key: "unit",
    label: "Ед.",
    type: "select",
    width: "80px",
    options: [
      { value: "pcs", label: "шт" },
      { value: "kg", label: "кг" },
      { value: "m", label: "м" },
    ],
  },
  {
    key: "side",
    label: "Сторона",
    type: "select",
    width: "100px",
    options: [
      { value: "NONE", label: "—" },
      { value: "LEFT", label: "Левая" },
      { value: "RIGHT", label: "Правая" },
    ],
  },
];

export function NomenclatureSetupTab() {
  const hook = useSetupImport("nomenclature");

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
