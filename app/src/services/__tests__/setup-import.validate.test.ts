import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createItem,
  createActiveBom,
  createActiveRouting,
  createStockBalance,
  ensureProcess,
  cleanup,
  resetTracker,
} from "@/__tests__/helpers/db";
import {
  validateNomenclature,
  validateStock,
  validateBom,
  validateRouting,
} from "@/services/setup-import.service";

// ============================================================
// Setup
// ============================================================

beforeAll(async () => {
  await ensureProcess("cutting", "Резка");
  await ensureProcess("welding-general", "Сварка");
});

afterEach(async () => {
  await cleanup();
});

// ============================================================
// validateNomenclature
// ============================================================

describe("validateNomenclature", () => {
  it("happy path — новая строка без code", async () => {
    const result = await validateNomenclature([
      { name: "Тестовый материал", type: "material", unit: "kg" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.estimatedChanges.rows.create).toBe(1);
  });

  it("happy path — новая строка с code", async () => {
    const result = await validateNomenclature([
      { name: "Деталь", type: "blank", unit: "pcs", code: "TX-8999" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.create).toBe(1);
  });

  it("существующий code без изменений → noop", async () => {
    const item = await createItem({ name: "Noop Test", type: "blank", unit: "pcs", side: "NONE" });
    const result = await validateNomenclature([
      { code: item.code, name: "Noop Test", type: "blank", unit: "pcs", side: "NONE" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.noop).toBe(1);
    expect(result.estimatedChanges.rows.update).toBe(0);
  });

  it("существующий code с изменением → update", async () => {
    const item = await createItem({ name: "Old Name", type: "blank", unit: "pcs" });
    const result = await validateNomenclature([
      { code: item.code, name: "New Name", type: "blank", unit: "pcs" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.update).toBe(1);
  });

  it("пустой name → ошибка", async () => {
    const result = await validateNomenclature([
      { name: "", type: "blank", unit: "pcs" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "name")).toBe(true);
  });

  it("invalid type → ошибка", async () => {
    const result = await validateNomenclature([
      { name: "Test", type: "invalid_type", unit: "pcs" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "type")).toBe(true);
  });

  it("invalid unit → ошибка", async () => {
    const result = await validateNomenclature([
      { name: "Test", type: "blank", unit: "liters" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "unit")).toBe(true);
  });

  it("material + side=LEFT → ошибка", async () => {
    const result = await validateNomenclature([
      { name: "Test mat", type: "material", unit: "kg", side: "LEFT" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "side")).toBe(true);
  });

  it("invalid code format → ошибка", async () => {
    const result = await validateNomenclature([
      { name: "Test", type: "blank", unit: "pcs", code: "bad-code" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "code")).toBe(true);
  });

  it("duplicate code in batch → ошибка", async () => {
    const result = await validateNomenclature([
      { name: "A", type: "blank", unit: "pcs", code: "TX-8100" },
      { name: "B", type: "blank", unit: "pcs", code: "TX-8100" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Дубль кода"))).toBe(true);
  });

  it("_delete=true без code → ошибка", async () => {
    const result = await validateNomenclature([
      { _delete: true },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "code")).toBe(true);
  });

  it("_delete=true — код не найден → ошибка", async () => {
    const result = await validateNomenclature([
      { _delete: true, code: "TX-8000" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("не найдена"))).toBe(true);
  });

  it("_delete=true — код найден → ok, delete count", async () => {
    const item = await createItem({ type: "blank" });
    const result = await validateNomenclature([
      { _delete: true, code: item.code },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.delete).toBe(1);
    expect(result.summary.deleteRows).toBe(1);
  });

  it("duplicate _delete=true → ошибка", async () => {
    const item = await createItem({ type: "blank" });
    const result = await validateNomenclature([
      { _delete: true, code: item.code },
      { _delete: true, code: item.code },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Дубль удаления"))).toBe(true);
  });

  it("_delete=true + upsert same code → ошибка", async () => {
    const item = await createItem({ type: "blank" });
    const result = await validateNomenclature([
      { _delete: true, code: item.code },
      { name: "Updated", type: "blank", unit: "pcs", code: item.code },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("одновременно удалять и изменять"))).toBe(true);
  });

  it("summary подсчёт", async () => {
    const item = await createItem({ type: "blank" });
    const result = await validateNomenclature([
      { name: "New1", type: "blank", unit: "pcs" },
      { name: "New2", type: "material", unit: "kg" },
      { _delete: true, code: item.code },
    ]);
    expect(result.summary.totalRows).toBe(3);
    expect(result.summary.deleteRows).toBe(1);
  });

  it("case-insensitive code normalization", async () => {
    const result = await validateNomenclature([
      { name: "A", type: "blank", unit: "pcs", code: "TX-8200" },
      { name: "B", type: "blank", unit: "pcs", code: "tx-8200" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Дубль кода"))).toBe(true);
  });
});

// ============================================================
// validateStock
// ============================================================

describe("validateStock", () => {
  it("happy path — income", async () => {
    const item = await createItem({ type: "material" });
    const result = await validateStock([
      { itemCode: item.code, qty: 10, mode: "income" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.create).toBe(1);
  });

  it("happy path — set", async () => {
    const item = await createItem({ type: "material" });
    await createStockBalance(item.id, 5);
    const result = await validateStock([
      { itemCode: item.code, qty: 10, mode: "set" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.update).toBe(1);
  });

  it("set с delta=0 → noop", async () => {
    const item = await createItem({ type: "material" });
    await createStockBalance(item.id, 10);
    const result = await validateStock([
      { itemCode: item.code, qty: 10, mode: "set" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.noop).toBe(1);
  });

  it("item без StockBalance — set → balance = 0, update при qty > 0", async () => {
    const item = await createItem({ type: "material" });
    const result = await validateStock([
      { itemCode: item.code, qty: 5, mode: "set" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.update).toBe(1);
  });

  it("item.type=product → ошибка", async () => {
    const item = await createItem({ type: "product" });
    const result = await validateStock([
      { itemCode: item.code, qty: 10, mode: "income" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Изделия нельзя"))).toBe(true);
  });

  it("itemCode не найден → ошибка", async () => {
    const result = await validateStock([
      { itemCode: "NONEXIST-999", qty: 10, mode: "income" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "itemCode")).toBe(true);
  });

  it("qty <= 0 для income → ошибка", async () => {
    const item = await createItem({ type: "material" });
    const result = await validateStock([
      { itemCode: item.code, qty: 0, mode: "income" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "qty")).toBe(true);
  });

  it("qty < 0 для set → ошибка", async () => {
    const item = await createItem({ type: "material" });
    const result = await validateStock([
      { itemCode: item.code, qty: -5, mode: "set" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "qty")).toBe(true);
  });

  it("invalid mode → ошибка", async () => {
    const item = await createItem({ type: "material" });
    const result = await validateStock([
      { itemCode: item.code, qty: 10, mode: "bad" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "mode")).toBe(true);
  });

  it("duplicate itemCode → ошибка", async () => {
    const item = await createItem({ type: "material" });
    const result = await validateStock([
      { itemCode: item.code, qty: 10, mode: "income" },
      { itemCode: item.code, qty: 5, mode: "set" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Дубликат"))).toBe(true);
  });

  it("_delete=true с balance=0 → noop", async () => {
    const item = await createItem({ type: "material" });
    const result = await validateStock([
      { _delete: true, itemCode: item.code },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.noop).toBe(1);
  });

  it("_delete=true с balance>0 → delete", async () => {
    const item = await createItem({ type: "material" });
    await createStockBalance(item.id, 10);
    const result = await validateStock([
      { _delete: true, itemCode: item.code },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.delete).toBe(1);
  });

  it("_delete + upsert same itemCode → ошибка", async () => {
    const item = await createItem({ type: "material" });
    const result = await validateStock([
      { _delete: true, itemCode: item.code },
      { itemCode: item.code, qty: 10, mode: "income" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("одновременно"))).toBe(true);
  });

  it("Excel number format normalization", async () => {
    const item = await createItem({ type: "material" });
    const result = await validateStock([
      { itemCode: item.code, qty: "10,5", mode: "income" },
    ]);
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// validateBom
// ============================================================

describe("validateBom", () => {
  it("happy path — valid BOM for one parent", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "blank" });
    const result = await validateBom([
      { parentCode: parent.code, componentCode: comp.code, qty: 2 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.create).toBe(1);
    expect(result.estimatedChanges.bom?.activate).toBe(1);
  });

  it("existing active BOM → update + archive", async () => {
    const parent = await createItem({ type: "product" });
    const comp1 = await createItem({ type: "blank" });
    const comp2 = await createItem({ type: "material" });
    await createActiveBom({ parentId: parent.id, components: [{ itemId: comp1.id, qty: 1 }] });

    const result = await validateBom([
      { parentCode: parent.code, componentCode: comp2.code, qty: 3 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.update).toBe(1);
    expect(result.estimatedChanges.bom?.archive).toBe(1);
    expect(result.estimatedChanges.bom?.activate).toBe(1);
  });

  it("parent not found → ошибка", async () => {
    const comp = await createItem({ type: "blank" });
    const result = await validateBom([
      { parentCode: "NONEXIST-999", componentCode: comp.code, qty: 1 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "parentCode")).toBe(true);
  });

  it("component not found → ошибка", async () => {
    const parent = await createItem({ type: "product" });
    const result = await validateBom([
      { parentCode: parent.code, componentCode: "NONEXIST-999", qty: 1 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "componentCode")).toBe(true);
  });

  it("parent=component → ошибка", async () => {
    // blank, потому что product не может быть компонентом (проверяется раньше)
    const item = await createItem({ type: "blank" });
    const result = await validateBom([
      { parentCode: item.code, componentCode: item.code, qty: 1 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("не могут совпадать"))).toBe(true);
  });

  it("parent.type=material → ошибка", async () => {
    const parent = await createItem({ type: "material" });
    const comp = await createItem({ type: "blank" });
    const result = await validateBom([
      { parentCode: parent.code, componentCode: comp.code, qty: 1 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Материал не может"))).toBe(true);
  });

  it("component.type=product → ошибка", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "product" });
    const result = await validateBom([
      { parentCode: parent.code, componentCode: comp.code, qty: 1 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Изделие не может"))).toBe(true);
  });

  it("qty <= 0 → ошибка", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "blank" });
    const result = await validateBom([
      { parentCode: parent.code, componentCode: comp.code, qty: 0 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.column === "qty")).toBe(true);
  });

  it("duplicate (parentCode, componentCode) → ошибка", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "blank" });
    const result = await validateBom([
      { parentCode: parent.code, componentCode: comp.code, qty: 1, lineNo: 1 },
      { parentCode: parent.code, componentCode: comp.code, qty: 2, lineNo: 2 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Дубль компонента"))).toBe(true);
  });

  it("_delete=true — BOM не существует → ошибка", async () => {
    const parent = await createItem({ type: "product" });
    const result = await validateBom([
      { _delete: true, parentCode: parent.code },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Нет BOM для удаления"))).toBe(true);
  });

  it("_delete=true — BOM существует → ok", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "blank" });
    await createActiveBom({ parentId: parent.id, components: [{ itemId: comp.id, qty: 1 }] });

    const result = await validateBom([
      { _delete: true, parentCode: parent.code },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.delete).toBe(1);
  });

  it("_delete + create same parent → ошибка", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "blank" });
    await createActiveBom({ parentId: parent.id, components: [{ itemId: comp.id, qty: 1 }] });

    const result = await validateBom([
      { _delete: true, parentCode: parent.code },
      { parentCode: parent.code, componentCode: comp.code, qty: 2 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("одновременно"))).toBe(true);
  });

  it("cycle detection A→B→C→A", async () => {
    // Все blank — product не может быть компонентом, что блокирует до DFS
    const a = await createItem({ type: "blank", name: "CycleA" });
    const b = await createItem({ type: "blank", name: "CycleB" });
    const c = await createItem({ type: "blank", name: "CycleC" });

    // Existing: B→C
    await createActiveBom({ parentId: b.id, components: [{ itemId: c.id, qty: 1 }] });

    // Новые данные: A→B, C→A — это цикл A→B→C→A
    const result = await validateBom([
      { parentCode: a.code, componentCode: b.code, qty: 1 },
      { parentCode: c.code, componentCode: a.code, qty: 1 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("цикл"))).toBe(true);
  });

  it("lineNo auto-generation", async () => {
    const parent = await createItem({ type: "product" });
    const c1 = await createItem({ type: "blank" });
    const c2 = await createItem({ type: "material" });
    const result = await validateBom([
      { parentCode: parent.code, componentCode: c1.code, qty: 1 },
      { parentCode: parent.code, componentCode: c2.code, qty: 2 },
    ]);
    expect(result.valid).toBe(true);
  });

  it("duplicate _delete by parentCode → ошибка", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "blank" });
    await createActiveBom({ parentId: parent.id, components: [{ itemId: comp.id, qty: 1 }] });
    const result = await validateBom([
      { _delete: true, parentCode: parent.code },
      { _delete: true, parentCode: parent.code },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Дубль удаления"))).toBe(true);
  });
});

// ============================================================
// validateRouting
// ============================================================

describe("validateRouting", () => {
  it("happy path — valid 1-step routing", async () => {
    const product = await createItem({ type: "product" });
    const material = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: material.code, inputQty: 0.5,
      },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.create).toBe(1);
    expect(result.estimatedChanges.routing?.activate).toBe(1);
  });

  it("happy path — multi-step routing", async () => {
    const product = await createItem({ type: "product" });
    const blank = await createItem({ type: "blank" });
    const material = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: blank.code, outputQty: 1,
        inputCode: material.code, inputQty: 0.5,
      },
      {
        itemCode: product.code, stepNo: 2, processCode: "welding-general",
        outputCode: product.code, outputQty: 1,
        inputCode: blank.code, inputQty: 1,
      },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.create).toBe(1);
  });

  it("item not found → ошибка", async () => {
    const mat = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: "NONEXIST-999", stepNo: 1, processCode: "cutting",
        outputCode: "NONEXIST-999", outputQty: 1,
        inputCode: mat.code, inputQty: 0.5,
      },
    ]);
    expect(result.valid).toBe(false);
  });

  it("item.type=material → ошибка", async () => {
    const mat = await createItem({ type: "material" });
    const mat2 = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: mat.code, stepNo: 1, processCode: "cutting",
        outputCode: mat.code, outputQty: 1,
        inputCode: mat2.code, inputQty: 0.5,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Материал не может"))).toBe(true);
  });

  it("output.type=material → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    const mat2 = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: mat.code, outputQty: 1,
        inputCode: mat2.code, inputQty: 0.5,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Материал не может быть выходом"))).toBe(true);
  });

  it("input.type=product → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const product2 = await createItem({ type: "product" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: product2.code, inputQty: 1,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Изделие не может быть входом"))).toBe(true);
  });

  it("inputCode = itemCode (self-reference) → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: product.code, inputQty: 1,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("совпадать с позицией маршрута"))).toBe(true);
  });

  it("inputCode = outputCode в шаге → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const blank = await createItem({ type: "blank" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: blank.code, outputQty: 1,
        inputCode: blank.code, inputQty: 0.5,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("совпадать с выходом шага"))).toBe(true);
  });

  it("duplicate (itemCode, stepNo, inputCode) → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat.code, inputQty: 0.5, sortOrder: 1,
      },
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat.code, inputQty: 0.3, sortOrder: 2,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Дубль входа"))).toBe(true);
  });

  it("processCode not found → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "nonexist-process",
        outputCode: product.code, outputQty: 1,
        inputCode: mat.code, inputQty: 0.5,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("не найден"))).toBe(true);
  });

  it("stepNo gap (1, 3) → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const blank = await createItem({ type: "blank" });
    const mat = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: blank.code, outputQty: 1,
        inputCode: mat.code, inputQty: 0.5,
      },
      {
        itemCode: product.code, stepNo: 3, processCode: "welding-general",
        outputCode: product.code, outputQty: 1,
        inputCode: blank.code, inputQty: 1,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("непрерывными"))).toBe(true);
  });

  it("stepNo > 100 → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 101, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat.code, inputQty: 0.5,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("100"))).toBe(true);
  });

  it("inconsistent processCode inside step → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const mat1 = await createItem({ type: "material" });
    const mat2 = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat1.code, inputQty: 0.5, sortOrder: 1,
      },
      {
        itemCode: product.code, stepNo: 1, processCode: "welding-general",
        outputCode: product.code, outputQty: 1,
        inputCode: mat2.code, inputQty: 0.3, sortOrder: 2,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("одинаковый processCode"))).toBe(true);
  });

  it("partial sortOrder (one present, another absent) → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const mat1 = await createItem({ type: "material" });
    const mat2 = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat1.code, inputQty: 0.5, sortOrder: 1,
      },
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat2.code, inputQty: 0.3,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("sortOrder"))).toBe(true);
  });

  it("last step outputCode ≠ itemCode → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const blank = await createItem({ type: "blank" });
    const mat = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: blank.code, outputQty: 1,
        inputCode: mat.code, inputQty: 0.5,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("последнего шага"))).toBe(true);
  });

  it("duplicate outputCode in routing → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const blank = await createItem({ type: "blank" });
    const mat = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: blank.code, outputQty: 1,
        inputCode: mat.code, inputQty: 0.5,
      },
      {
        itemCode: product.code, stepNo: 2, processCode: "cutting",
        outputCode: blank.code, outputQty: 1,
        inputCode: mat.code, inputQty: 0.3,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("дублируется"))).toBe(true);
  });

  it("_delete=true — маршрут не существует → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const result = await validateRouting([
      { _delete: true, itemCode: product.code },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Нет маршрута"))).toBe(true);
  });

  it("_delete=true — маршрут существует → ok", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    await createActiveRouting({
      itemId: product.id,
      steps: [{ stepNo: 1, processId: "cutting", outputItemId: product.id, outputQty: 1, inputs: [{ itemId: mat.id, qty: 0.5, sortOrder: 1 }] }],
    });
    const result = await validateRouting([
      { _delete: true, itemCode: product.code },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.delete).toBe(1);
  });

  it("_delete + create same itemCode → ошибка", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    await createActiveRouting({
      itemId: product.id,
      steps: [{ stepNo: 1, processId: "cutting", outputItemId: product.id, outputQty: 1, inputs: [{ itemId: mat.id, qty: 0.5, sortOrder: 1 }] }],
    });
    const result = await validateRouting([
      { _delete: true, itemCode: product.code },
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat.code, inputQty: 0.5,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("одновременно"))).toBe(true);
  });

  it("existing active routing → update + archive", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    const mat2 = await createItem({ type: "material" });
    await createActiveRouting({
      itemId: product.id,
      steps: [{ stepNo: 1, processId: "cutting", outputItemId: product.id, outputQty: 1, inputs: [{ itemId: mat.id, qty: 0.5, sortOrder: 1 }] }],
    });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat2.code, inputQty: 0.3,
      },
    ]);
    expect(result.valid).toBe(true);
    expect(result.estimatedChanges.rows.update).toBe(1);
    expect(result.estimatedChanges.routing?.archive).toBe(1);
    expect(result.estimatedChanges.routing?.activate).toBe(1);
  });

  it("sortOrder omitted everywhere → auto ok", async () => {
    const product = await createItem({ type: "product" });
    const mat1 = await createItem({ type: "material" });
    const mat2 = await createItem({ type: "material" });
    const result = await validateRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat1.code, inputQty: 0.5,
      },
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat2.code, inputQty: 0.3,
      },
    ]);
    expect(result.valid).toBe(true);
  });
});
