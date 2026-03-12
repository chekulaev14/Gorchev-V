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
// Rollback: importNomenclature
// ============================================================

describe("importNomenclature — rollback", () => {
  it("если одна строка падает, первые строки не коммитятся", async () => {
    // Создаём item с зависимостью (active BOM), который нельзя удалить
    const parent = await createItem({ type: "product", name: "Parent for BOM" });
    const comp = await createItem({ type: "blank", name: "Component" });
    await createActiveBom({ parentId: parent.id, components: [{ itemId: comp.id, qty: 1 }] });

    // Пачка: 2 валидных create + 1 delete что упадёт (item с active BOM)
    await expect(
      importNomenclature([
        { name: "ShouldNotExist1", type: "material", unit: "kg" },
        { name: "ShouldNotExist2", type: "blank", unit: "pcs" },
        { _delete: true, code: comp.code }, // comp используется в BOM → ошибка
      ])
    ).rejects.toThrow();

    // Проверить: ни одна из первых двух строк не создалась
    const found1 = await prisma.item.findFirst({ where: { name: "ShouldNotExist1", deletedAt: null } });
    const found2 = await prisma.item.findFirst({ where: { name: "ShouldNotExist2", deletedAt: null } });
    expect(found1).toBeNull();
    expect(found2).toBeNull();

    // Comp не удалён
    const compCheck = await prisma.item.findUnique({ where: { id: comp.id } });
    expect(compCheck!.deletedAt).toBeNull();
  });
});

// ============================================================
// Rollback: importStock
// ============================================================

describe("importStock — rollback", () => {
  it("если пачка содержит невалидные данные → validate отклоняет, ничего не коммитится", async () => {
    const item1 = await createItem({ type: "material" });
    const item2 = await createItem({ type: "material" });
    await createStockBalance(item1.id, 0);
    await createStockBalance(item2.id, 0);

    // Строка 1 валидная, строка 2 — product (запрещён)
    const product = await createItem({ type: "product" });
    await expect(
      importStock([
        { itemCode: item1.code, qty: 100, mode: "income" },
        { itemCode: product.code, qty: 50, mode: "income" },
      ])
    ).rejects.toThrow(/валидации/);

    // Проверить: item1 баланс не изменился
    const bal = await prisma.stockBalance.findUnique({
      where: { itemId_locationId: { itemId: item1.id, locationId: "MAIN" } },
    });
    expect(toNumber(bal!.quantity)).toBe(0);
  });
});

// ============================================================
// Rollback: importBom
// ============================================================

describe("importBom — rollback", () => {
  it("если один parent в пачке невалиден → ничего не коммитится", async () => {
    const p1 = await createItem({ type: "product" });
    const p2 = await createItem({ type: "product" });
    const c1 = await createItem({ type: "blank" });

    // p1 валиден, p2 → componentCode не существует → validate отклонит
    await expect(
      importBom([
        { parentCode: p1.code, componentCode: c1.code, qty: 1 },
        { parentCode: p2.code, componentCode: "NONEXIST-999", qty: 1 },
      ])
    ).rejects.toThrow(/валидации/);

    // p1 не получил BOM
    const bom = await prisma.bom.findFirst({
      where: { itemId: p1.id, status: "ACTIVE" },
    });
    expect(bom).toBeNull();
  });

  it("delete blocked by ProductionOrder → rollback", async () => {
    const parent = await createItem({ type: "product" });
    const comp = await createItem({ type: "blank" });
    const bom = await createActiveBom({ parentId: parent.id, components: [{ itemId: comp.id, qty: 1 }] });

    // Создать worker для ProductionOrder (нужен creator)
    const worker = await prisma.worker.findFirst();
    if (!worker) {
      // Если нет воркера, создадим
      await prisma.worker.create({
        data: { id: "test-worker-rollback", name: "Test Worker", pin: "9999", active: true },
      });
    }
    const workerId = worker?.id ?? "test-worker-rollback";

    // Создать ProductionOrder привязанный к BOM
    const order = await prisma.productionOrder.create({
      data: {
        id: "test-order-rollback",
        itemId: parent.id,
        itemName: parent.name,
        quantityPlanned: 10,
        bomId: bom.id,
        createdBy: workerId,
        status: "PLANNED",
      },
    });

    // p2 — другой parent, валидный
    const p2 = await createItem({ type: "product" });
    const c2 = await createItem({ type: "blank" });

    await expect(
      importBom([
        { _delete: true, parentCode: parent.code }, // blocked by order
        { parentCode: p2.code, componentCode: c2.code, qty: 1 }, // валидный, но в той же транзакции
      ])
    ).rejects.toThrow(/заказ/i);

    // BOM parent НЕ архивирован
    const bomCheck = await prisma.bom.findUnique({ where: { id: bom.id } });
    expect(bomCheck!.status).toBe("ACTIVE");

    // p2 НЕ получил BOM
    const bomP2 = await prisma.bom.findFirst({ where: { itemId: p2.id, status: "ACTIVE" } });
    expect(bomP2).toBeNull();

    // Cleanup
    await prisma.productionOrder.delete({ where: { id: "test-order-rollback" } });
    if (!worker) {
      await prisma.worker.delete({ where: { id: "test-worker-rollback" } });
    }
  });
});

// ============================================================
// Rollback: importRouting
// ============================================================

// ============================================================
// Regression: importRouting — outputItemId conflict fix
// ============================================================

describe("importRouting — regression: outputItemId conflict", () => {
  it("replace active routing with same outputItemId — no duplicate ACTIVE", async () => {
    // Regression: раньше activateRouting проверяла uniqueness ДО архивирования,
    // что вызывало "уже есть активный маршрут" при замене маршрута с тем же outputItemId
    const product = await createItem({ type: "product" });
    const mat1 = await createItem({ type: "material" });
    const mat2 = await createItem({ type: "material" });

    // Старый ACTIVE с outputItemId = product.id
    const oldRouting = await createActiveRouting({
      itemId: product.id,
      steps: [{ stepNo: 1, processId: "cutting", outputItemId: product.id, outputQty: 1, inputs: [{ itemId: mat1.id, qty: 0.5, sortOrder: 1 }] }],
    });

    // Новый маршрут с тем же outputItemId (product.code)
    const result = await importRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: product.code, outputQty: 1,
        inputCode: mat2.code, inputQty: 0.3,
      },
    ]);
    expect(result.updated).toBe(1);

    // Старый ARCHIVED
    const archived = await prisma.routing.findUnique({ where: { id: oldRouting.id } });
    expect(archived!.status).toBe("ARCHIVED");

    // Ровно один ACTIVE
    const activeRoutings = await prisma.routing.findMany({
      where: { itemId: product.id, status: "ACTIVE" },
    });
    expect(activeRoutings).toHaveLength(1);
    expect(activeRoutings[0].id).not.toBe(oldRouting.id);
  });

  it("multi-step routing update — intermediate outputItemId preserved", async () => {
    const product = await createItem({ type: "product" });
    const blank = await createItem({ type: "blank" });
    const mat = await createItem({ type: "material" });
    const mat2 = await createItem({ type: "material" });

    // Старый 2-step маршрут
    await createActiveRouting({
      itemId: product.id,
      steps: [
        { stepNo: 1, processId: "cutting", outputItemId: blank.id, outputQty: 1, inputs: [{ itemId: mat.id, qty: 0.5, sortOrder: 1 }] },
        { stepNo: 2, processId: "welding-general", outputItemId: product.id, outputQty: 1, inputs: [{ itemId: blank.id, qty: 1, sortOrder: 1 }] },
      ],
    });

    // Новый маршрут с теми же outputItemId
    const result = await importRouting([
      {
        itemCode: product.code, stepNo: 1, processCode: "cutting",
        outputCode: blank.code, outputQty: 1,
        inputCode: mat2.code, inputQty: 0.3,
      },
      {
        itemCode: product.code, stepNo: 2, processCode: "welding-general",
        outputCode: product.code, outputQty: 1,
        inputCode: blank.code, inputQty: 1,
      },
    ]);
    expect(result.updated).toBe(1);

    // Ровно один ACTIVE
    const activeRoutings = await prisma.routing.findMany({
      where: { itemId: product.id, status: "ACTIVE" },
    });
    expect(activeRoutings).toHaveLength(1);
  });
});

// ============================================================
// Rollback: importRouting
// ============================================================

describe("importRouting — rollback", () => {
  it("если один маршрут невалиден → вся пачка откатывается", async () => {
    const p1 = await createItem({ type: "product" });
    const p2 = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });

    // p1 — валидный маршрут, p2 — невалидный (inputCode не существует)
    await expect(
      importRouting([
        {
          itemCode: p1.code, stepNo: 1, processCode: "cutting",
          outputCode: p1.code, outputQty: 1,
          inputCode: mat.code, inputQty: 0.5,
        },
        {
          itemCode: p2.code, stepNo: 1, processCode: "cutting",
          outputCode: p2.code, outputQty: 1,
          inputCode: "NONEXIST-999", inputQty: 0.5,
        },
      ])
    ).rejects.toThrow(/валидации/);

    // p1 не получил маршрут
    const routing = await prisma.routing.findFirst({
      where: { itemId: p1.id, status: "ACTIVE" },
    });
    expect(routing).toBeNull();
  });

  it("delete blocked by ProductionOperation → rollback", async () => {
    const product = await createItem({ type: "product" });
    const mat = await createItem({ type: "material" });
    const routing = await createActiveRouting({
      itemId: product.id,
      steps: [{ stepNo: 1, processId: "cutting", outputItemId: product.id, outputQty: 1, inputs: [{ itemId: mat.id, qty: 0.5, sortOrder: 1 }] }],
    });

    // Создать ProductionOperation привязанную к routing step
    const invOp = await prisma.inventoryOperation.create({
      data: { operationKey: `test-invop-rollback-${Date.now()}`, type: "ASSEMBLY" },
    });
    const prodOp = await prisma.productionOperation.create({
      data: {
        id: `test-prodop-rollback-${Date.now()}`,
        itemId: product.id,
        quantity: 10,
        routingStepId: routing.steps[0].id,
        inventoryOperationId: invOp.id,
      },
    });

    // Другой product, валидный
    const p2 = await createItem({ type: "product" });
    const mat2 = await createItem({ type: "material" });

    await expect(
      importRouting([
        { _delete: true, itemCode: product.code }, // blocked by ProductionOperation
        {
          itemCode: p2.code, stepNo: 1, processCode: "cutting",
          outputCode: p2.code, outputQty: 1,
          inputCode: mat2.code, inputQty: 0.3,
        },
      ])
    ).rejects.toThrow(/операции/i);

    // routing НЕ архивирован
    const routingCheck = await prisma.routing.findUnique({ where: { id: routing.id } });
    expect(routingCheck!.status).toBe("ACTIVE");

    // p2 не получил маршрут
    const routingP2 = await prisma.routing.findFirst({ where: { itemId: p2.id, status: "ACTIVE" } });
    expect(routingP2).toBeNull();

    // Cleanup
    await prisma.productionOperation.delete({ where: { id: prodOp.id } });
    await prisma.inventoryOperation.delete({ where: { id: invOp.id } });
  });
});
