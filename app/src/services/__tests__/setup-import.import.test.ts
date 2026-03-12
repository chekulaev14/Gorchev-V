import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createItem,
  createActiveBom,
  createActiveRouting,
  createStockBalance,
  ensureProcess,
  cleanup,
  prisma,
} from "@/__tests__/helpers/db";
import {
  importNomenclature,
  importStock,
  importBom,
  importRouting,
} from "@/services/setup-import.service";
import { toNumber } from "@/services/helpers/serialize";

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
// importNomenclature
// ============================================================

describe("importNomenclature", () => {
  it("create — новая позиция без code (auto-generate)", async () => {
    const result = await importNomenclature([
      { name: "Import Test Material", type: "material", unit: "kg" },
    ]);
    expect(result.imported).toBe(1);
    expect(result.updated).toBe(0);

    // Проверить в БД
    const found = await prisma.item.findFirst({ where: { name: "Import Test Material", deletedAt: null } });
    expect(found).toBeTruthy();
    expect(found!.code).toMatch(/^MAT-\d{3,}$/);
    // Cleanup: track this item
    if (found) {
      await prisma.item.delete({ where: { id: found.id } });
    }
  });

  it("create — новая позиция с explicit code", async () => {
    const result = await importNomenclature([
      { name: "Explicit Code Item", type: "blank", unit: "pcs", code: "TX-8888" },
    ]);
    expect(result.imported).toBe(1);

    const found = await prisma.item.findFirst({ where: { code: "TX-8888" } });
    expect(found).toBeTruthy();
    expect(found!.name).toBe("Explicit Code Item");
    if (found) await prisma.item.delete({ where: { id: found.id } });
  });

  it("update — изменение существующей позиции", async () => {
    const item = await createItem({ name: "Old Name", type: "blank", unit: "pcs" });
    const result = await importNomenclature([
      { code: item.code, name: "New Name", type: "blank", unit: "pcs" },
    ]);
    expect(result.updated).toBe(1);

    const updated = await prisma.item.findUnique({ where: { id: item.id } });
    expect(updated!.name).toBe("New Name");
  });

  it("noop — без изменений → skipped", async () => {
    const item = await createItem({ name: "Same Name", type: "blank", unit: "pcs", side: "NONE" });
    const result = await importNomenclature([
      { code: item.code, name: "Same Name", type: "blank", unit: "pcs", side: "NONE" },
    ]);
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
  });

  it("soft delete — без зависимостей", async () => {
    const item = await createItem({ type: "blank" });
    const result = await importNomenclature([
      { _delete: true, code: item.code },
    ]);
    expect(result.deleted).toBe(1);

    const deleted = await prisma.item.findUnique({ where: { id: item.id } });
    expect(deleted!.deletedAt).not.toBeNull();
  });

  it("delete blocked — ненулевой StockBalance", async () => {
    const item = await createItem({ type: "blank" });
    await createStockBalance(item.id, 10);

    await expect(
      importNomenclature([{ _delete: true, code: item.code }])
    ).rejects.toThrow(/ненулевой остаток/);
  });

  it("delete blocked — активный BOM", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "blank" });
    await createActiveBom({ parentId: parent.id, components: [{ itemId: comp.id, qty: 1 }] });

    await expect(
      importNomenclature([{ _delete: true, code: comp.code }])
    ).rejects.toThrow(/BOM/);
  });

  it("delete blocked — активный routing (output)", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    await createActiveRouting({
      itemId: product.id,
      steps: [{ stepNo: 1, processId: "cutting", outputItemId: product.id, outputQty: 1, inputs: [{ itemId: mat.id, qty: 0.5, sortOrder: 1 }] }],
    });

    await expect(
      importNomenclature([{ _delete: true, code: product.code }])
    ).rejects.toThrow(/маршрут/);
  });

  it("delete blocked — активный routing (input)", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    await createActiveRouting({
      itemId: product.id,
      steps: [{ stepNo: 1, processId: "cutting", outputItemId: product.id, outputQty: 1, inputs: [{ itemId: mat.id, qty: 0.5, sortOrder: 1 }] }],
    });

    await expect(
      importNomenclature([{ _delete: true, code: mat.code }])
    ).rejects.toThrow(/маршрут/);
  });

  it("delete blocked — item является parent активного BOM", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "blank" });
    await createActiveBom({ parentId: parent.id, components: [{ itemId: comp.id, qty: 1 }] });

    await expect(
      importNomenclature([{ _delete: true, code: parent.code }])
    ).rejects.toThrow(/BOM/);
  });

  it("delete blocked — есть складские движения", async () => {
    const item = await createItem({ type: "material" });
    // Создадим складское движение через stock service
    const stockService = await import("@/services/stock.service");
    await stockService.createIncomeOperation({
      type: "SUPPLIER_INCOME",
      itemId: item.id,
      quantity: 5,
      operationKey: `test-movement-${Date.now()}`,
    });

    await expect(
      importNomenclature([{ _delete: true, code: item.code }])
    ).rejects.toThrow(/движения/);
  });

  it("delete blocked — есть производственные операции", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    const routing = await createActiveRouting({
      itemId: product.id,
      steps: [{ stepNo: 1, processId: "cutting", outputItemId: product.id, outputQty: 1, inputs: [{ itemId: mat.id, qty: 0.5, sortOrder: 1 }] }],
    });

    // Создать ProductionOperation привязанную к этому item
    const invOp = await prisma.inventoryOperation.create({
      data: { operationKey: `test-dep-invop-${Date.now()}`, type: "ASSEMBLY" },
    });
    await prisma.productionOperation.create({
      data: {
        id: `test-dep-prodop-${Date.now()}`,
        itemId: product.id,
        quantity: 10,
        routingStepId: routing.steps[0].id,
        inventoryOperationId: invOp.id,
      },
    });

    // Удаление product.code должно быть заблокировано routing output раньше,
    // но мы проверяем mat (input) — у него нет routing, нет BOM, но есть... нет.
    // Для чистого теста ProductionOperation нужен item без routing и BOM.
    // Создадим отдельный item с ProductionOperation напрямую.
    const standalone = await createItem({ type: "blank" });
    const invOp2 = await prisma.inventoryOperation.create({
      data: { operationKey: `test-dep-invop2-${Date.now()}`, type: "ASSEMBLY" },
    });
    const prodOp = await prisma.productionOperation.create({
      data: {
        id: `test-dep-prodop2-${Date.now()}`,
        itemId: standalone.id,
        quantity: 5,
        inventoryOperationId: invOp2.id,
      },
    });

    await expect(
      importNomenclature([{ _delete: true, code: standalone.code }])
    ).rejects.toThrow(/производственные операции/);

    // Cleanup manual entities
    await prisma.productionOperation.deleteMany({ where: { itemId: { in: [product.id, standalone.id] } } });
    await prisma.inventoryOperation.deleteMany({ where: { id: { in: [invOp.id, invOp2.id] } } });
  });
});

// ============================================================
// importStock
// ============================================================

describe("importStock", () => {
  it("income — создаёт складскую операцию", async () => {
    const item = await createItem({ type: "material" });
    const result = await importStock([
      { itemCode: item.code, qty: 25, mode: "income" },
    ]);
    expect(result.imported).toBe(1);

    // Проверить баланс
    const bal = await prisma.stockBalance.findUnique({
      where: { itemId_locationId: { itemId: item.id, locationId: "MAIN" } },
    });
    expect(toNumber(bal!.quantity)).toBe(25);
  });

  it("set — positive delta (корректировка прихода)", async () => {
    const item = await createItem({ type: "material" });
    await createStockBalance(item.id, 5);
    const result = await importStock([
      { itemCode: item.code, qty: 15, mode: "set" },
    ]);
    expect(result.updated).toBe(1);

    const bal = await prisma.stockBalance.findUnique({
      where: { itemId_locationId: { itemId: item.id, locationId: "MAIN" } },
    });
    expect(toNumber(bal!.quantity)).toBe(15);
  });

  it("set — negative delta (корректировка списания)", async () => {
    const item = await createItem({ type: "material" });
    await createStockBalance(item.id, 20);
    const result = await importStock([
      { itemCode: item.code, qty: 8, mode: "set" },
    ]);
    expect(result.updated).toBe(1);

    const bal = await prisma.stockBalance.findUnique({
      where: { itemId_locationId: { itemId: item.id, locationId: "MAIN" } },
    });
    expect(toNumber(bal!.quantity)).toBe(8);
  });

  it("set — delta=0 → skipped", async () => {
    const item = await createItem({ type: "material" });
    await createStockBalance(item.id, 10);
    const result = await importStock([
      { itemCode: item.code, qty: 10, mode: "set" },
    ]);
    expect(result.skipped).toBe(1);
  });

  it("_delete — balance>0 → обнуление через adjustment", async () => {
    const item = await createItem({ type: "material" });
    await createStockBalance(item.id, 15);
    const result = await importStock([
      { _delete: true, itemCode: item.code },
    ]);
    expect(result.deleted).toBe(1);

    const bal = await prisma.stockBalance.findUnique({
      where: { itemId_locationId: { itemId: item.id, locationId: "MAIN" } },
    });
    expect(toNumber(bal!.quantity)).toBe(0);
  });

  it("_delete — balance=0 → skipped", async () => {
    const item = await createItem({ type: "material" });
    await createStockBalance(item.id, 0);
    const result = await importStock([
      { _delete: true, itemCode: item.code },
    ]);
    expect(result.skipped).toBe(1);
  });
});

// ============================================================
// importBom
// ============================================================

describe("importBom", () => {
  it("create — новый ACTIVE BOM", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "blank" });
    const result = await importBom([
      { parentCode: parent.code, componentCode: comp.code, qty: 3 },
    ]);
    expect(result.imported).toBe(1);

    // Проверить ACTIVE BOM в БД
    const bom = await prisma.bom.findFirst({
      where: { itemId: parent.id, status: "ACTIVE" },
      include: { lines: true },
    });
    expect(bom).toBeTruthy();
    expect(bom!.lines).toHaveLength(1);
    expect(toNumber(bom!.lines[0].quantity)).toBe(3);
  });

  it("update — старый ACTIVE архивируется, новый создаётся", async () => {
    const parent = await createItem({ type: "product" });
    const comp1 = await createItem({ type: "blank" });
    const comp2 = await createItem({ type: "material" });
    const oldBom = await createActiveBom({ parentId: parent.id, components: [{ itemId: comp1.id, qty: 1 }] });

    const result = await importBom([
      { parentCode: parent.code, componentCode: comp2.code, qty: 5 },
    ]);
    expect(result.updated).toBe(1);

    // Старый архивирован
    const archived = await prisma.bom.findUnique({ where: { id: oldBom.id } });
    expect(archived!.status).toBe("ARCHIVED");

    // Новый ACTIVE
    const activeBom = await prisma.bom.findFirst({
      where: { itemId: parent.id, status: "ACTIVE" },
      include: { lines: true },
    });
    expect(activeBom).toBeTruthy();
    expect(activeBom!.id).not.toBe(oldBom.id);
    expect(activeBom!.lines).toHaveLength(1);
  });

  it("_delete — архивирует ACTIVE", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "blank" });
    const bom = await createActiveBom({ parentId: parent.id, components: [{ itemId: comp.id, qty: 1 }] });

    const result = await importBom([
      { _delete: true, parentCode: parent.code },
    ]);
    expect(result.deleted).toBe(1);

    const archived = await prisma.bom.findUnique({ where: { id: bom.id } });
    expect(archived!.status).toBe("ARCHIVED");
  });

  it("multiple parents в одной пачке", async () => {
    const p1 = await createItem({ type: "product" });
    const p2 = await createItem({ type: "product" });
    const c1 = await createItem({ type: "blank" });
    const c2 = await createItem({ type: "material" });

    const result = await importBom([
      { parentCode: p1.code, componentCode: c1.code, qty: 1 },
      { parentCode: p2.code, componentCode: c2.code, qty: 2 },
    ]);
    expect(result.imported).toBe(2);

    const boms = await prisma.bom.findMany({
      where: { itemId: { in: [p1.id, p2.id] }, status: "ACTIVE" },
    });
    expect(boms).toHaveLength(2);
  });
});

// ============================================================
// importRouting
// ============================================================

describe("importRouting", () => {
  it("create — новый ACTIVE routing", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });

    const result = await importRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat.code, inputQty: 0.5,
      },
    ]);
    expect(result.imported).toBe(1);

    // Проверить ACTIVE routing в БД
    const routing = await prisma.routing.findFirst({
      where: { itemId: product.id, status: "ACTIVE" },
      include: { steps: { include: { inputs: true } } },
    });
    expect(routing).toBeTruthy();
    expect(routing!.steps).toHaveLength(1);
    expect(routing!.steps[0].inputs).toHaveLength(1);
  });

  it("update — старый ACTIVE архивируется", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    const mat2 = await createItem({ type: "material" });
    const oldRouting = await createActiveRouting({
      itemId: product.id,
      steps: [{ stepNo: 1, processId: "cutting", outputItemId: product.id, outputQty: 1, inputs: [{ itemId: mat.id, qty: 0.5, sortOrder: 1 }] }],
    });

    const result = await importRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat2.code, inputQty: 0.3,
      },
    ]);
    expect(result.updated).toBe(1);

    const archived = await prisma.routing.findUnique({ where: { id: oldRouting.id } });
    expect(archived!.status).toBe("ARCHIVED");

    const active = await prisma.routing.findFirst({
      where: { itemId: product.id, status: "ACTIVE" },
    });
    expect(active).toBeTruthy();
    expect(active!.id).not.toBe(oldRouting.id);
  });

  it("_delete — архивирует ACTIVE", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    const routing = await createActiveRouting({
      itemId: product.id,
      steps: [{ stepNo: 1, processId: "cutting", outputItemId: product.id, outputQty: 1, inputs: [{ itemId: mat.id, qty: 0.5, sortOrder: 1 }] }],
    });

    const result = await importRouting([
      { _delete: true, itemCode: product.code },
    ]);
    expect(result.deleted).toBe(1);

    const archived = await prisma.routing.findUnique({ where: { id: routing.id } });
    expect(archived!.status).toBe("ARCHIVED");
  });

  it("multi-step routing сохраняется корректно", async () => {
    const product = await createItem({ type: "product" });
    const blank = await createItem({ type: "blank" });
    const mat = await createItem({ type: "material" });

    const result = await importRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: blank.code, outputQty: 1,
        inputCode: mat.code, inputQty: 0.5,
      },
      {
        itemCode: product.code, stepNo: 2, processCode: "welding-general",
        outputCode: product.code, outputQty: 1,
        inputCode: blank.code, inputQty: 1,
      },
    ]);
    expect(result.imported).toBe(1);

    const routing = await prisma.routing.findFirst({
      where: { itemId: product.id, status: "ACTIVE" },
      include: { steps: { orderBy: { stepNo: "asc" }, include: { inputs: true } } },
    });
    expect(routing!.steps).toHaveLength(2);
    expect(routing!.steps[0].stepNo).toBe(1);
    expect(routing!.steps[1].stepNo).toBe(2);
  });

  it("assembly (multiple inputs per step)", async () => {
    const product = await createItem({ type: "product" });
    const mat1 = await createItem({ type: "material" });
    const mat2 = await createItem({ type: "material" });

    const result = await importRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat1.code, inputQty: 0.5, sortOrder: 1,
      },
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat2.code, inputQty: 0.3, sortOrder: 2,
      },
    ]);
    expect(result.imported).toBe(1);

    const routing = await prisma.routing.findFirst({
      where: { itemId: product.id, status: "ACTIVE" },
      include: { steps: { include: { inputs: true } } },
    });
    expect(routing!.steps[0].inputs).toHaveLength(2);
  });
});
