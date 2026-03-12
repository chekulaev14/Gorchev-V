import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/api/handle-route-error";
import { toNumber } from "./helpers/serialize";
import { getNextCode, toCodeKind } from "./helpers/code-generator";
import { validateBomSide, validateRoutingStepsSide } from "./helpers/validate-side";
import * as nomenclatureService from "./nomenclature.service";
import * as stockService from "./stock.service";
import * as bomVersionService from "./bom-version.service";
import * as routingService from "./routing.service";
import {
  VALID_TYPES,
  VALID_UNITS,
  VALID_SIDES,
  VALID_STOCK_MODES,
  MAX_DISTINCT_ROUTING_ITEMS,
  MAX_DISTINCT_BOM_PARENTS,
} from "@/lib/schemas/setup-import.schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ============================================================
// Types
// ============================================================

interface ValidationError {
  row: number;
  column?: string;
  message: string;
}

interface ValidationSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  deleteRows: number;
}

interface EstimatedChanges {
  rows: { create: number; update: number; delete: number; noop: number };
  bom?: { activate: number; archive: number };
  routing?: { activate: number; archive: number };
}

interface ValidateResult {
  valid: boolean;
  errors: ValidationError[];
  summary: ValidationSummary;
  estimatedChanges: EstimatedChanges;
}

interface ImportResult {
  imported: number;
  updated: number;
  deleted: number;
  skipped: number;
}

// ============================================================
// Helpers
// ============================================================

const CODE_REGEX = /^[A-Z]{2,4}-\d{3,4}$/;

/** Нормализация числа из Excel (пробелы, запятые, non-breaking spaces) */
function normalizeNumber(val: unknown): number | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const s = String(val)
    .replace(/[\u00A0\u202F\u200B]/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeString(val: unknown): string {
  if (val == null) return "";
  return String(val).trim();
}

// ============================================================
// LOAD
// ============================================================

export async function loadNomenclature() {
  const items = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { code: true, name: true, typeId: true, unitId: true, side: true },
    orderBy: [{ typeId: "asc" }, { name: "asc" }],
  });
  return items.map((it) => ({
    code: it.code,
    name: it.name,
    type: it.typeId,
    unit: it.unitId,
    side: it.side,
  }));
}

export async function loadStock() {
  const items = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { code: true },
    orderBy: { code: "asc" },
  });
  const codeToId = new Map<string, string>();
  const allItems = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  });
  for (const it of allItems) codeToId.set(it.code, it.id);

  const balances = await prisma.stockBalance.findMany({
    where: { locationId: "MAIN" },
    select: { itemId: true, quantity: true },
  });
  const balMap = new Map<string, number>();
  for (const b of balances) balMap.set(b.itemId, toNumber(b.quantity));

  return items.map((it) => {
    const itemId = codeToId.get(it.code) ?? "";
    return {
      itemCode: it.code,
      qty: balMap.get(itemId) ?? 0,
      mode: "set" as const,
    };
  });
}

export async function loadBom() {
  const boms = await prisma.bom.findMany({
    where: { status: "ACTIVE" },
    include: {
      item: { select: { code: true } },
      lines: {
        include: { componentItem: { select: { code: true } } },
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });

  const rows: { parentCode: string; componentCode: string; qty: number; lineNo: number }[] = [];
  for (const bom of boms) {
    for (const line of bom.lines) {
      rows.push({
        parentCode: bom.item.code,
        componentCode: line.componentItem.code,
        qty: toNumber(line.quantity),
        lineNo: line.lineNo,
      });
    }
  }
  rows.sort((a, b) => a.parentCode.localeCompare(b.parentCode) || a.lineNo - b.lineNo || a.componentCode.localeCompare(b.componentCode));
  return rows;
}

export async function loadRouting() {
  const routings = await prisma.routing.findMany({
    where: { status: "ACTIVE" },
    include: {
      item: { select: { code: true } },
      steps: {
        orderBy: { stepNo: "asc" },
        include: {
          process: { select: { id: true } },
          outputItem: { select: { code: true } },
          inputs: {
            orderBy: { sortOrder: "asc" },
            include: { item: { select: { code: true } } },
          },
        },
      },
    },
  });

  const rows: {
    itemCode: string; stepNo: number; processCode: string;
    outputCode: string; outputQty: number; inputCode: string;
    inputQty: number; sortOrder: number;
  }[] = [];

  for (const r of routings) {
    for (const step of r.steps) {
      for (const inp of step.inputs) {
        rows.push({
          itemCode: r.item.code,
          stepNo: step.stepNo,
          processCode: step.process.id,
          outputCode: step.outputItem.code,
          outputQty: toNumber(step.outputQty),
          inputCode: inp.item.code,
          inputQty: toNumber(inp.qty),
          sortOrder: inp.sortOrder,
        });
      }
    }
  }
  rows.sort((a, b) =>
    a.itemCode.localeCompare(b.itemCode) || a.stepNo - b.stepNo || a.sortOrder - b.sortOrder
  );
  return rows;
}

// ============================================================
// VALIDATE — Nomenclature
// ============================================================

export async function validateNomenclature(rows: Record<string, unknown>[]): Promise<ValidateResult> {
  const errors: ValidationError[] = [];
  const deleteRows: number[] = [];
  const upsertRows: number[] = [];

  // Загрузить все items по code
  const existingItems = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, name: true, typeId: true, unitId: true, side: true },
  });
  const codeToItem = new Map(existingItems.map((it) => [it.code.toUpperCase(), it]));

  // Собрать коды для delete и upsert
  const deleteCodesSet = new Set<string>();
  const upsertCodesSet = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isDelete = row._delete === true;

    if (isDelete) {
      const code = normalizeString(row.code).toUpperCase();
      if (!code) {
        errors.push({ row: i, column: "code", message: "Code обязателен для удаления" });
        continue;
      }
      if (deleteCodesSet.has(code)) {
        errors.push({ row: i, column: "code", message: `Дубль удаления: ${code}` });
        continue;
      }
      deleteCodesSet.add(code);
      deleteRows.push(i);
    } else {
      const code = normalizeString(row.code).toUpperCase();
      if (code) upsertCodesSet.add(code);
      upsertRows.push(i);
    }
  }

  // Delete + Create запрет
  for (const code of deleteCodesSet) {
    if (upsertCodesSet.has(code)) {
      const delIdx = deleteRows.find((i) => normalizeString(rows[i].code).toUpperCase() === code);
      if (delIdx !== undefined) {
        errors.push({ row: delIdx, column: "code", message: "Нельзя одновременно удалять и изменять позицию" });
      }
    }
  }

  // Validate delete rows
  for (const i of deleteRows) {
    const code = normalizeString(rows[i].code).toUpperCase();
    if (deleteCodesSet.has(code) && !codeToItem.has(code)) {
      // Пропускаем дубли (ошибка уже выше), проверяем существование
      if (!errors.some((e) => e.row === i)) {
        errors.push({ row: i, column: "code", message: `Позиция ${code} не найдена` });
      }
    }
  }

  // Validate upsert rows
  const seenCodes = new Set<string>();
  let creates = 0, updates = 0, noops = 0, deletes = 0;

  for (const i of upsertRows) {
    const row = rows[i];
    const name = normalizeString(row.name);
    const type = normalizeString(row.type).toLowerCase();
    const unit = normalizeString(row.unit).toLowerCase();
    const side = normalizeString(row.side).toUpperCase() || "NONE";
    const code = normalizeString(row.code).toUpperCase();

    if (!name) errors.push({ row: i, column: "name", message: "Название обязательно" });
    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      errors.push({ row: i, column: "type", message: `Недопустимый тип: ${type || "(пусто)"}. Допустимые: ${VALID_TYPES.join(", ")}` });
    }
    if (!VALID_UNITS.includes(unit as typeof VALID_UNITS[number])) {
      errors.push({ row: i, column: "unit", message: `Недопустимая единица: ${unit || "(пусто)"}. Допустимые: ${VALID_UNITS.join(", ")}` });
    }
    if (!VALID_SIDES.includes(side as typeof VALID_SIDES[number])) {
      errors.push({ row: i, column: "side", message: `Недопустимая сторона: ${side}. Допустимые: ${VALID_SIDES.join(", ")}` });
    }
    if (type === "material" && side !== "NONE") {
      errors.push({ row: i, column: "side", message: "Материал не может иметь сторону (только NONE)" });
    }

    if (code) {
      if (!CODE_REGEX.test(code)) {
        errors.push({ row: i, column: "code", message: `Формат кода: 2-4 буквы, дефис, 3-4 цифры (например PRD-001)` });
      }
      if (seenCodes.has(code)) {
        errors.push({ row: i, column: "code", message: `Дубль кода ${code} внутри пачки` });
      }
      seenCodes.add(code);
    }

    // EstimatedChanges
    if (!errors.some((e) => e.row === i)) {
      if (!code) {
        creates++;
      } else {
        const existing = codeToItem.get(code);
        if (!existing) {
          creates++;
        } else {
          const changed =
            existing.name !== name ||
            existing.typeId !== type ||
            existing.unitId !== unit ||
            (existing.side ?? "NONE") !== side;
          if (changed) updates++;
          else noops++;
        }
      }
    }
  }

  // Count valid deletes
  for (const i of deleteRows) {
    if (!errors.some((e) => e.row === i)) {
      deletes++;
    }
  }

  const errorRowSet = new Set(errors.map((e) => e.row));
  return {
    valid: errors.length === 0,
    errors,
    summary: {
      totalRows: rows.length,
      validRows: rows.length - errorRowSet.size,
      errorRows: errorRowSet.size,
      deleteRows: deleteRows.length,
    },
    estimatedChanges: {
      rows: { create: creates, update: updates, delete: deletes, noop: noops },
    },
  };
}

// ============================================================
// VALIDATE — Stock
// ============================================================

export async function validateStock(rows: Record<string, unknown>[]): Promise<ValidateResult> {
  const errors: ValidationError[] = [];
  const deleteIdxs: number[] = [];
  const upsertIdxs: number[] = [];

  // Загрузить items
  const allItems = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, typeId: true },
  });
  const codeToItem = new Map(allItems.map((it) => [it.code.toUpperCase(), it]));

  // Загрузить балансы
  const balances = await prisma.stockBalance.findMany({
    where: { locationId: "MAIN" },
    select: { itemId: true, quantity: true },
  });
  const balMap = new Map<string, number>();
  for (const b of balances) balMap.set(b.itemId, toNumber(b.quantity));

  const deleteCodesSet = new Set<string>();
  const upsertCodesSet = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isDelete = row._delete === true;
    const itemCode = normalizeString(row.itemCode).toUpperCase();

    if (isDelete) {
      if (!itemCode) {
        errors.push({ row: i, column: "itemCode", message: "itemCode обязателен для удаления" });
        continue;
      }
      if (deleteCodesSet.has(itemCode)) {
        errors.push({ row: i, column: "itemCode", message: `Дубль удаления: ${itemCode}` });
        continue;
      }
      deleteCodesSet.add(itemCode);
      deleteIdxs.push(i);
    } else {
      if (itemCode) {
        if (upsertCodesSet.has(itemCode)) {
          errors.push({ row: i, column: "itemCode", message: `Дубликат itemCode: ${itemCode}` });
        }
        upsertCodesSet.add(itemCode);
      }
      upsertIdxs.push(i);
    }
  }

  // Delete + Upsert запрет
  for (const code of deleteCodesSet) {
    if (upsertCodesSet.has(code)) {
      const delIdx = deleteIdxs.find((i) => normalizeString(rows[i].itemCode).toUpperCase() === code);
      if (delIdx !== undefined) {
        errors.push({ row: delIdx, column: "itemCode", message: "Нельзя одновременно удалять и изменять остаток" });
      }
    }
  }

  let creates = 0, updates = 0, noops = 0, deletes = 0;

  // Validate delete rows
  for (const i of deleteIdxs) {
    const itemCode = normalizeString(rows[i].itemCode).toUpperCase();
    const item = codeToItem.get(itemCode);
    if (!item) {
      if (!errors.some((e) => e.row === i)) {
        errors.push({ row: i, column: "itemCode", message: `Позиция ${itemCode} не найдена` });
      }
    } else if (!errors.some((e) => e.row === i)) {
      const bal = balMap.get(item.id) ?? 0;
      if (bal === 0) noops++;
      else deletes++;
    }
  }

  // Validate upsert rows
  for (const i of upsertIdxs) {
    const row = rows[i];
    const itemCode = normalizeString(row.itemCode).toUpperCase();
    const mode = normalizeString(row.mode).toLowerCase();
    const qtyVal = normalizeNumber(row.qty);

    if (!itemCode) {
      errors.push({ row: i, column: "itemCode", message: "itemCode обязателен" });
      continue;
    }

    const item = codeToItem.get(itemCode);
    if (!item) {
      errors.push({ row: i, column: "itemCode", message: `Позиция ${itemCode} не найдена` });
      continue;
    }

    if (item.typeId === "product") {
      errors.push({ row: i, column: "itemCode", message: "Изделия нельзя вводить через setup" });
      continue;
    }

    if (!VALID_STOCK_MODES.includes(mode as typeof VALID_STOCK_MODES[number])) {
      errors.push({ row: i, column: "mode", message: `Недопустимый режим: ${mode || "(пусто)"}. Допустимые: income, set` });
      continue;
    }

    if (qtyVal === null) {
      errors.push({ row: i, column: "qty", message: "Некорректное число" });
      continue;
    }

    if (mode === "income" && qtyVal <= 0) {
      errors.push({ row: i, column: "qty", message: "qty должен быть > 0 для mode=income" });
      continue;
    }

    if (mode === "set" && qtyVal < 0) {
      errors.push({ row: i, column: "qty", message: "qty должен быть >= 0 для mode=set" });
      continue;
    }

    // EstimatedChanges
    if (!errors.some((e) => e.row === i)) {
      if (mode === "income") {
        creates++;
      } else {
        const currentBal = balMap.get(item.id) ?? 0;
        const delta = qtyVal - currentBal;
        if (delta === 0) noops++;
        else updates++;
      }
    }
  }

  const errorRowSet = new Set(errors.map((e) => e.row));
  return {
    valid: errors.length === 0,
    errors,
    summary: {
      totalRows: rows.length,
      validRows: rows.length - errorRowSet.size,
      errorRows: errorRowSet.size,
      deleteRows: deleteIdxs.length,
    },
    estimatedChanges: {
      rows: { create: creates, update: updates, delete: deletes, noop: noops },
    },
  };
}

// ============================================================
// VALIDATE — BOM
// ============================================================

export async function validateBom(rows: Record<string, unknown>[]): Promise<ValidateResult> {
  const errors: ValidationError[] = [];

  // Загрузить items
  const allItems = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, name: true, typeId: true, side: true },
  });
  const codeToItem = new Map(allItems.map((it) => [it.code.toUpperCase(), it]));

  // Загрузить active BOMs
  const activeBoms = await prisma.bom.findMany({
    where: { status: "ACTIVE" },
    include: { lines: { include: { componentItem: { select: { id: true } } } } },
  });
  const itemIdToActiveBom = new Map(activeBoms.map((b) => [b.itemId, b]));

  // Distinct parents limit
  const parentCodes = new Set<string>();
  for (const row of rows) {
    const pc = normalizeString(row.parentCode).toUpperCase();
    if (pc) parentCodes.add(pc);
  }
  if (parentCodes.size > MAX_DISTINCT_BOM_PARENTS) {
    throw new ServiceError(`Слишком много составов в одной пачке (${parentCodes.size} > ${MAX_DISTINCT_BOM_PARENTS}). Разбейте импорт`, 400);
  }

  // Classify rows
  const deleteParentCodes = new Set<string>();
  const upsertParentCodes = new Set<string>();
  const deleteIdxs: number[] = [];
  const upsertIdxs: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isDelete = row._delete === true;
    const parentCode = normalizeString(row.parentCode).toUpperCase();

    if (isDelete) {
      if (!parentCode) {
        errors.push({ row: i, column: "parentCode", message: "parentCode обязателен для удаления" });
        continue;
      }
      if (deleteParentCodes.has(parentCode)) {
        errors.push({ row: i, column: "parentCode", message: `Дубль удаления BOM: ${parentCode}` });
        continue;
      }
      deleteParentCodes.add(parentCode);
      deleteIdxs.push(i);
    } else {
      if (parentCode) upsertParentCodes.add(parentCode);
      upsertIdxs.push(i);
    }
  }

  // Delete + Create запрет
  for (const code of deleteParentCodes) {
    if (upsertParentCodes.has(code)) {
      const delIdx = deleteIdxs.find((i) => normalizeString(rows[i].parentCode).toUpperCase() === code);
      if (delIdx !== undefined) {
        errors.push({ row: delIdx, column: "parentCode", message: "Нельзя одновременно удалять и создавать BOM для одной позиции" });
      }
    }
  }

  // Validate deletes
  let deleteCount = 0;
  for (const i of deleteIdxs) {
    const parentCode = normalizeString(rows[i].parentCode).toUpperCase();
    const parentItem = codeToItem.get(parentCode);
    if (!parentItem) {
      if (!errors.some((e) => e.row === i)) {
        errors.push({ row: i, column: "parentCode", message: `Позиция ${parentCode} не найдена` });
      }
      continue;
    }
    const activeBom = itemIdToActiveBom.get(parentItem.id);
    if (!activeBom) {
      if (!errors.some((e) => e.row === i)) {
        errors.push({ row: i, column: "parentCode", message: `Нет BOM для удаления: ${parentCode}` });
      }
      continue;
    }
    if (!errors.some((e) => e.row === i)) deleteCount++;
  }

  // Group upsert rows by parentCode
  const grouped = new Map<string, { idx: number; row: Record<string, unknown> }[]>();
  for (const i of upsertIdxs) {
    const row = rows[i];
    const parentCode = normalizeString(row.parentCode).toUpperCase();
    if (!parentCode) {
      errors.push({ row: i, column: "parentCode", message: "parentCode обязателен" });
      continue;
    }
    if (!grouped.has(parentCode)) grouped.set(parentCode, []);
    grouped.get(parentCode)!.push({ idx: i, row });
  }

  let createCount = 0, updateCount = 0, noopCount = 0;
  let activateCount = 0, archiveCount = 0;

  // Validate each parent group
  for (const [parentCode, groupRows] of grouped) {
    const parentItem = codeToItem.get(parentCode);
    if (!parentItem) {
      for (const { idx } of groupRows) {
        errors.push({ row: idx, column: "parentCode", message: `Позиция ${parentCode} не найдена` });
      }
      continue;
    }
    if (parentItem.typeId === "material") {
      for (const { idx } of groupRows) {
        errors.push({ row: idx, column: "parentCode", message: "Материал не может иметь BOM" });
      }
      continue;
    }

    // Validate each line
    const componentPairs = new Set<string>();
    const lineNos = new Set<number>();
    const components: { name: string; side: string }[] = [];
    let groupValid = true;
    let autoLineNo = 1;

    for (const { idx, row } of groupRows) {
      const componentCode = normalizeString(row.componentCode).toUpperCase();
      const qtyVal = normalizeNumber(row.qty);
      let lineNo = normalizeNumber(row.lineNo);

      if (!componentCode) {
        errors.push({ row: idx, column: "componentCode", message: "componentCode обязателен" });
        groupValid = false;
        continue;
      }

      const compItem = codeToItem.get(componentCode);
      if (!compItem) {
        errors.push({ row: idx, column: "componentCode", message: `Позиция ${componentCode} не найдена` });
        groupValid = false;
        continue;
      }

      if (compItem.typeId === "product") {
        errors.push({ row: idx, column: "componentCode", message: "Изделие не может быть компонентом BOM" });
        groupValid = false;
        continue;
      }

      if (parentCode === componentCode) {
        errors.push({ row: idx, column: "componentCode", message: "parentCode и componentCode не могут совпадать" });
        groupValid = false;
        continue;
      }

      const pairKey = `${parentCode}:${componentCode}`;
      if (componentPairs.has(pairKey)) {
        errors.push({ row: idx, column: "componentCode", message: `Дубль компонента ${componentCode} для ${parentCode}` });
        groupValid = false;
        continue;
      }
      componentPairs.add(pairKey);

      if (qtyVal === null || qtyVal <= 0) {
        errors.push({ row: idx, column: "qty", message: "qty должен быть > 0" });
        groupValid = false;
        continue;
      }

      if (lineNo !== null) {
        if (!Number.isInteger(lineNo) || lineNo < 1) {
          errors.push({ row: idx, column: "lineNo", message: "lineNo должен быть целым числом >= 1" });
          groupValid = false;
          continue;
        }
        if (lineNos.has(lineNo)) {
          errors.push({ row: idx, column: "lineNo", message: `Дубль lineNo ${lineNo} для ${parentCode}` });
          groupValid = false;
          continue;
        }
        lineNos.add(lineNo);
      } else {
        // auto
        while (lineNos.has(autoLineNo)) autoLineNo++;
        lineNos.add(autoLineNo);
        lineNo = autoLineNo;
        autoLineNo++;
      }

      components.push({ name: compItem.name, side: compItem.side ?? "NONE" });
    }

    // Side validation
    if (groupValid && components.length > 0) {
      try {
        validateBomSide({
          parentItem: { name: parentItem.name, side: parentItem.side ?? "NONE" },
          components,
        });
      } catch (e) {
        if (e instanceof ServiceError) {
          errors.push({ row: groupRows[0].idx, column: "parentCode", message: e.message });
          groupValid = false;
        } else throw e;
      }
    }

    // Estimated changes (per parent, not per row)
    if (groupValid) {
      const existingBom = itemIdToActiveBom.get(parentItem.id);
      if (existingBom) {
        updateCount++;
        archiveCount++;
      } else {
        createCount++;
      }
      activateCount++;
    }
  }

  // Cycle detection (DFS) — check new BOM links + existing ones
  if (errors.length === 0) {
    // Build adjacency: parent -> component[]
    const adj = new Map<string, Set<string>>();

    // Existing active BOMs
    for (const bom of activeBoms) {
      const parentId = bom.itemId;
      if (!adj.has(parentId)) adj.set(parentId, new Set());
      for (const line of bom.lines) {
        adj.get(parentId)!.add(line.componentItem.id);
      }
    }

    // Override with new data
    for (const [parentCode, groupRows] of grouped) {
      const parentItem = codeToItem.get(parentCode);
      if (!parentItem) continue;
      // Replace entire BOM for this parent
      adj.set(parentItem.id, new Set());
      for (const { row } of groupRows) {
        const componentCode = normalizeString(row.componentCode).toUpperCase();
        const compItem = codeToItem.get(componentCode);
        if (compItem) adj.get(parentItem.id)!.add(compItem.id);
      }
    }

    // Remove deleted BOMs
    for (const parentCode of deleteParentCodes) {
      const parentItem = codeToItem.get(parentCode);
      if (parentItem) adj.delete(parentItem.id);
    }

    // DFS cycle detection
    const visited = new Set<string>();
    const inStack = new Set<string>();

    function hasCycle(node: string): boolean {
      if (inStack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      inStack.add(node);
      const children = adj.get(node);
      if (children) {
        for (const child of children) {
          if (hasCycle(child)) return true;
        }
      }
      inStack.delete(node);
      return false;
    }

    for (const node of adj.keys()) {
      if (hasCycle(node)) {
        errors.push({ row: 0, message: "Обнаружен цикл в BOM. Проверьте зависимости" });
        break;
      }
    }
  }

  // Adjust archive for deletes
  archiveCount += deleteCount;

  const errorRowSet = new Set(errors.map((e) => e.row));
  return {
    valid: errors.length === 0,
    errors,
    summary: {
      totalRows: rows.length,
      validRows: rows.length - errorRowSet.size,
      errorRows: errorRowSet.size,
      deleteRows: deleteIdxs.length,
    },
    estimatedChanges: {
      rows: { create: createCount, update: updateCount, delete: deleteCount, noop: noopCount },
      bom: { activate: activateCount, archive: archiveCount },
    },
  };
}

// ============================================================
// VALIDATE — Routing
// ============================================================

export async function validateRouting(rows: Record<string, unknown>[]): Promise<ValidateResult> {
  const errors: ValidationError[] = [];

  // Load items
  const allItems = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, name: true, typeId: true, side: true },
  });
  const codeToItem = new Map(allItems.map((it) => [it.code.toUpperCase(), it]));

  // Load processes
  const allProcesses = await prisma.process.findMany({ select: { id: true } });
  const processIds = new Set(allProcesses.map((p) => p.id));

  // Load active routings
  const activeRoutings = await prisma.routing.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, itemId: true },
  });
  const itemIdToActiveRouting = new Map(activeRoutings.map((r) => [r.itemId, r]));

  // Distinct items limit
  const itemCodesAll = new Set<string>();
  for (const row of rows) {
    const ic = normalizeString(row.itemCode).toUpperCase();
    if (ic) itemCodesAll.add(ic);
  }
  if (itemCodesAll.size > MAX_DISTINCT_ROUTING_ITEMS) {
    throw new ServiceError(`Слишком много маршрутов в одной пачке (${itemCodesAll.size} > ${MAX_DISTINCT_ROUTING_ITEMS}). Разбейте импорт`, 400);
  }

  // Classify
  const deleteItemCodes = new Set<string>();
  const upsertItemCodes = new Set<string>();
  const deleteIdxs: number[] = [];
  const upsertIdxs: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isDelete = row._delete === true;
    const itemCode = normalizeString(row.itemCode).toUpperCase();

    if (isDelete) {
      if (!itemCode) {
        errors.push({ row: i, column: "itemCode", message: "itemCode обязателен для удаления" });
        continue;
      }
      if (deleteItemCodes.has(itemCode)) {
        errors.push({ row: i, column: "itemCode", message: `Дубль удаления маршрута: ${itemCode}` });
        continue;
      }
      deleteItemCodes.add(itemCode);
      deleteIdxs.push(i);
    } else {
      if (itemCode) upsertItemCodes.add(itemCode);
      upsertIdxs.push(i);
    }
  }

  // Delete + Create запрет
  for (const code of deleteItemCodes) {
    if (upsertItemCodes.has(code)) {
      const delIdx = deleteIdxs.find((i) => normalizeString(rows[i].itemCode).toUpperCase() === code);
      if (delIdx !== undefined) {
        errors.push({ row: delIdx, column: "itemCode", message: "Нельзя одновременно удалять и создавать маршрут для одной позиции" });
      }
    }
  }

  // Validate deletes
  let deleteCount = 0;
  for (const i of deleteIdxs) {
    const itemCode = normalizeString(rows[i].itemCode).toUpperCase();
    const item = codeToItem.get(itemCode);
    if (!item) {
      if (!errors.some((e) => e.row === i)) {
        errors.push({ row: i, column: "itemCode", message: `Позиция ${itemCode} не найдена` });
      }
      continue;
    }
    const active = itemIdToActiveRouting.get(item.id);
    if (!active) {
      if (!errors.some((e) => e.row === i)) {
        errors.push({ row: i, column: "itemCode", message: `Нет маршрута для удаления: ${itemCode}` });
      }
      continue;
    }
    if (!errors.some((e) => e.row === i)) deleteCount++;
  }

  // Group upsert rows by itemCode
  const grouped = new Map<string, { idx: number; row: Record<string, unknown> }[]>();
  for (const i of upsertIdxs) {
    const row = rows[i];
    const itemCode = normalizeString(row.itemCode).toUpperCase();
    if (!itemCode) {
      errors.push({ row: i, column: "itemCode", message: "itemCode обязателен" });
      continue;
    }
    if (!grouped.has(itemCode)) grouped.set(itemCode, []);
    grouped.get(itemCode)!.push({ idx: i, row });
  }

  let createCount = 0, updateCount = 0, noopCount = 0;
  let activateCount = 0, archiveCount = 0;

  // Validate each item group
  for (const [itemCode, groupRows] of grouped) {
    const routingItem = codeToItem.get(itemCode);
    if (!routingItem) {
      for (const { idx } of groupRows) {
        errors.push({ row: idx, column: "itemCode", message: `Позиция ${itemCode} не найдена` });
      }
      continue;
    }
    if (routingItem.typeId === "material") {
      for (const { idx } of groupRows) {
        errors.push({ row: idx, column: "itemCode", message: "Материал не может иметь маршрут" });
      }
      continue;
    }

    // Group by stepNo
    const stepMap = new Map<number, { idx: number; row: Record<string, unknown> }[]>();
    let groupValid = true;

    for (const entry of groupRows) {
      const stepNoVal = normalizeNumber(entry.row.stepNo);
      if (stepNoVal === null || !Number.isInteger(stepNoVal) || stepNoVal < 1) {
        errors.push({ row: entry.idx, column: "stepNo", message: "stepNo обязателен, целое число >= 1" });
        groupValid = false;
        continue;
      }
      if (stepNoVal > 100) {
        errors.push({ row: entry.idx, column: "stepNo", message: "stepNo не может быть > 100" });
        groupValid = false;
        continue;
      }
      if (!stepMap.has(stepNoVal)) stepMap.set(stepNoVal, []);
      stepMap.get(stepNoVal)!.push(entry);
    }

    if (!groupValid) continue;

    // Validate step continuity
    const stepNos = [...stepMap.keys()].sort((a, b) => a - b);
    for (let i = 0; i < stepNos.length; i++) {
      if (stepNos[i] !== i + 1) {
        const firstRow = stepMap.get(stepNos[i])![0];
        errors.push({ row: firstRow.idx, column: "stepNo", message: `stepNo должны быть непрерывными (1..N). Ожидался ${i + 1}, получен ${stepNos[i]}` });
        groupValid = false;
        break;
      }
    }
    if (!groupValid) continue;

    // Validate each step
    const outputCodesInRouting = new Set<string>();
    const sideSteps: { stepNo: number; outputItem: { name: string; side: string }; inputs: { item: { name: string; side: string } }[] }[] = [];
    const inputTriplets = new Set<string>();

    for (const stepNo of stepNos) {
      const stepRows = stepMap.get(stepNo)!;

      // All rows in step must have same processCode, outputCode, outputQty
      const processCodes = new Set<string>();
      const outputCodes = new Set<string>();
      const outputQtys = new Set<number>();

      for (const { idx, row } of stepRows) {
        const pc = normalizeString(row.processCode);
        const oc = normalizeString(row.outputCode).toUpperCase();
        const oq = normalizeNumber(row.outputQty);

        if (pc) processCodes.add(pc);
        if (oc) outputCodes.add(oc);
        if (oq !== null) outputQtys.add(oq);

        // Basic field validation
        if (!pc) {
          errors.push({ row: idx, column: "processCode", message: "processCode обязателен" });
          groupValid = false;
        } else if (!processIds.has(pc)) {
          errors.push({ row: idx, column: "processCode", message: `Процесс ${pc} не найден` });
          groupValid = false;
        }

        if (!oc) {
          errors.push({ row: idx, column: "outputCode", message: "outputCode обязателен" });
          groupValid = false;
        } else {
          const outputItem = codeToItem.get(oc);
          if (!outputItem) {
            errors.push({ row: idx, column: "outputCode", message: `Позиция ${oc} не найдена` });
            groupValid = false;
          } else if (outputItem.typeId === "material") {
            errors.push({ row: idx, column: "outputCode", message: "Материал не может быть выходом шага" });
            groupValid = false;
          }
        }

        if (oq === null || oq <= 0) {
          errors.push({ row: idx, column: "outputQty", message: "outputQty должен быть > 0" });
          groupValid = false;
        }

        // Input validation
        const inputCode = normalizeString(row.inputCode).toUpperCase();
        const inputQty = normalizeNumber(row.inputQty);

        if (!inputCode) {
          errors.push({ row: idx, column: "inputCode", message: "inputCode обязателен" });
          groupValid = false;
        } else {
          const inputItem = codeToItem.get(inputCode);
          if (!inputItem) {
            errors.push({ row: idx, column: "inputCode", message: `Позиция ${inputCode} не найдена` });
            groupValid = false;
          } else if (inputItem.typeId === "product") {
            errors.push({ row: idx, column: "inputCode", message: "Изделие не может быть входом шага" });
            groupValid = false;
          }

          if (inputCode === itemCode) {
            errors.push({ row: idx, column: "inputCode", message: "Вход не может совпадать с позицией маршрута" });
            groupValid = false;
          }

          if (inputCode && oc && inputCode === oc) {
            errors.push({ row: idx, column: "inputCode", message: "Вход не может совпадать с выходом шага" });
            groupValid = false;
          }

          // Triplet uniqueness
          const triplet = `${itemCode}:${stepNo}:${inputCode}`;
          if (inputTriplets.has(triplet)) {
            errors.push({ row: idx, column: "inputCode", message: `Дубль входа ${inputCode} в шаге ${stepNo}` });
            groupValid = false;
          }
          inputTriplets.add(triplet);
        }

        if (inputQty === null || inputQty <= 0) {
          errors.push({ row: idx, column: "inputQty", message: "inputQty должен быть > 0" });
          groupValid = false;
        }
      }

      if (!groupValid) continue;

      // Consistency within step
      if (processCodes.size > 1) {
        errors.push({ row: stepRows[0].idx, column: "processCode", message: `Все строки шага ${stepNo} должны иметь одинаковый processCode` });
        groupValid = false;
      }
      if (outputCodes.size > 1) {
        errors.push({ row: stepRows[0].idx, column: "outputCode", message: `Все строки шага ${stepNo} должны иметь одинаковый outputCode` });
        groupValid = false;
      }
      if (outputQtys.size > 1) {
        errors.push({ row: stepRows[0].idx, column: "outputQty", message: `Все строки шага ${stepNo} должны иметь одинаковый outputQty` });
        groupValid = false;
      }

      if (!groupValid) continue;

      // outputCode unique in routing
      const outputCode = [...outputCodes][0];
      if (outputCodesInRouting.has(outputCode)) {
        errors.push({ row: stepRows[0].idx, column: "outputCode", message: `outputCode ${outputCode} дублируется в маршруте` });
        groupValid = false;
        continue;
      }
      outputCodesInRouting.add(outputCode);

      // sortOrder validation
      const sortOrders = stepRows.map(({ row }) => normalizeNumber(row.sortOrder));
      const hasExplicit = sortOrders.some((s) => s !== null);
      const hasMissing = sortOrders.some((s) => s === null);

      if (hasExplicit && hasMissing) {
        for (const { idx, row } of stepRows) {
          if (normalizeNumber(row.sortOrder) === null) {
            errors.push({ row: idx, column: "sortOrder", message: "Если sortOrder указан хотя бы для одной строки шага, он обязателен для всех" });
          }
        }
        groupValid = false;
        continue;
      }

      if (hasExplicit) {
        const sortSet = new Set<number>();
        for (const { idx, row } of stepRows) {
          const so = normalizeNumber(row.sortOrder)!;
          if (!Number.isInteger(so)) {
            errors.push({ row: idx, column: "sortOrder", message: "sortOrder должен быть целым числом" });
            groupValid = false;
          } else if (sortSet.has(so)) {
            errors.push({ row: idx, column: "sortOrder", message: `Дубль sortOrder ${so} в шаге ${stepNo}` });
            groupValid = false;
          }
          sortSet.add(so);
        }
      }

      if (!groupValid) continue;

      // Collect for side validation
      const outputItem = codeToItem.get(outputCode)!;
      sideSteps.push({
        stepNo,
        outputItem: { name: outputItem.name, side: outputItem.side ?? "NONE" },
        inputs: stepRows.map(({ row }) => {
          const ic = normalizeString(row.inputCode).toUpperCase();
          const item = codeToItem.get(ic)!;
          return { item: { name: item.name, side: item.side ?? "NONE" } };
        }),
      });
    }

    if (!groupValid) continue;

    // Last step output = itemCode
    const lastStepNo = stepNos[stepNos.length - 1];
    const lastStepRows = stepMap.get(lastStepNo)!;
    const lastOutputCode = normalizeString(lastStepRows[0].row.outputCode).toUpperCase();
    if (lastOutputCode !== itemCode) {
      errors.push({
        row: lastStepRows[0].idx,
        column: "outputCode",
        message: `Выход последнего шага (${lastOutputCode}) должен совпадать с itemCode маршрута (${itemCode})`,
      });
      continue;
    }

    // Side validation
    if (sideSteps.length > 0) {
      try {
        validateRoutingStepsSide(sideSteps);
      } catch (e) {
        if (e instanceof ServiceError) {
          errors.push({ row: groupRows[0].idx, column: "itemCode", message: e.message });
          continue;
        }
        throw e;
      }
    }

    // Estimated changes
    const existing = itemIdToActiveRouting.get(routingItem.id);
    if (existing) {
      updateCount++;
      archiveCount++;
    } else {
      createCount++;
    }
    activateCount++;
  }

  archiveCount += deleteCount;

  const errorRowSet = new Set(errors.map((e) => e.row));
  return {
    valid: errors.length === 0,
    errors,
    summary: {
      totalRows: rows.length,
      validRows: rows.length - errorRowSet.size,
      errorRows: errorRowSet.size,
      deleteRows: deleteIdxs.length,
    },
    estimatedChanges: {
      rows: { create: createCount, update: updateCount, delete: deleteCount, noop: noopCount },
      routing: { activate: activateCount, archive: archiveCount },
    },
  };
}

// ============================================================
// IMPORT — Nomenclature
// ============================================================

export async function importNomenclature(rows: Record<string, unknown>[]): Promise<ImportResult> {
  // Re-validate
  const validation = await validateNomenclature(rows);
  if (!validation.valid) {
    throw new ServiceError("Ошибки валидации", 400, validation.errors);
  }

  return prisma.$transaction(async (tx) => {
    let imported = 0, updated = 0, deleted = 0, skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const isDelete = row._delete === true;

      if (isDelete) {
        const code = normalizeString(row.code).toUpperCase();
        const item = await tx.item.findFirst({ where: { code, deletedAt: null } });
        if (!item) continue;

        // Check dependencies
        await checkItemDeletionDependencies(tx, item.id, code);

        await tx.item.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
        deleted++;
        continue;
      }

      const name = normalizeString(row.name);
      const type = normalizeString(row.type).toLowerCase();
      const unit = normalizeString(row.unit).toLowerCase();
      const side = (normalizeString(row.side).toUpperCase() || "NONE") as "LEFT" | "RIGHT" | "NONE";
      const code = normalizeString(row.code).toUpperCase();

      if (code) {
        // Try find existing
        const existing = await tx.item.findFirst({ where: { code, deletedAt: null } });
        if (existing) {
          const changed =
            existing.name !== name ||
            existing.typeId !== type ||
            existing.unitId !== unit ||
            (existing.side ?? "NONE") !== side;
          if (!changed) {
            skipped++;
            continue;
          }
          await tx.item.update({
            where: { id: existing.id },
            data: { name, typeId: type, unitId: unit, side },
          });
          updated++;
        } else {
          await tx.item.create({
            data: {
              id: crypto.randomUUID(),
              code,
              name,
              typeId: type,
              unitId: unit,
              side,
              images: [],
            },
          });
          imported++;
        }
      } else {
        // Auto-generate code
        const generatedCode = await getNextCode(tx as unknown as Tx, toCodeKind(type));
        await tx.item.create({
          data: {
            id: crypto.randomUUID(),
            code: generatedCode,
            name,
            typeId: type,
            unitId: unit,
            side,
            images: [],
          },
        });
        imported++;
      }
    }

    return { imported, updated, deleted, skipped };
  });
}

async function checkItemDeletionDependencies(tx: Tx, itemId: string, code: string) {
  // Active BOM lines
  const bomLineCount = await tx.bomLine.count({
    where: {
      componentItemId: itemId,
      bom: { status: "ACTIVE" },
    },
  });
  if (bomLineCount > 0) {
    throw new ServiceError(`Нельзя удалить ${code} — используется в активных BOM (${bomLineCount} строк)`, 400);
  }

  // BOM as parent
  const bomParentCount = await tx.bom.count({
    where: { itemId, status: "ACTIVE" },
  });
  if (bomParentCount > 0) {
    throw new ServiceError(`Нельзя удалить ${code} — имеет активный BOM`, 400);
  }

  // Routing step output
  const routingOutputCount = await tx.routingStep.count({
    where: { outputItemId: itemId, routing: { status: "ACTIVE" } },
  });
  if (routingOutputCount > 0) {
    throw new ServiceError(`Нельзя удалить ${code} — используется как выход в активных маршрутах`, 400);
  }

  // Routing step input
  const routingInputCount = await tx.routingStepInput.count({
    where: { itemId, step: { routing: { status: "ACTIVE" } } },
  });
  if (routingInputCount > 0) {
    throw new ServiceError(`Нельзя удалить ${code} — используется как вход в активных маршрутах`, 400);
  }

  // Stock movements
  const movementCount = await tx.stockMovement.count({ where: { itemId } });
  if (movementCount > 0) {
    throw new ServiceError(`Нельзя удалить ${code} — есть складские движения (${movementCount})`, 400);
  }

  // Production operations
  const prodOpCount = await tx.productionOperation.count({ where: { itemId } });
  if (prodOpCount > 0) {
    throw new ServiceError(`Нельзя удалить ${code} — есть производственные операции`, 400);
  }

  // StockBalance != 0
  const balance = await tx.stockBalance.findUnique({
    where: { itemId_locationId: { itemId, locationId: "MAIN" } },
  });
  if (balance && toNumber(balance.quantity) !== 0) {
    throw new ServiceError(`Нельзя удалить ${code} — ненулевой остаток на складе (${toNumber(balance.quantity)})`, 400);
  }
}

// ============================================================
// IMPORT — Stock
// ============================================================

export async function importStock(rows: Record<string, unknown>[]): Promise<ImportResult> {
  const validation = await validateStock(rows);
  if (!validation.valid) {
    throw new ServiceError("Ошибки валидации", 400, validation.errors);
  }

  // Resolve items
  const allItems = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  });
  const codeToId = new Map(allItems.map((it) => [it.code.toUpperCase(), it.id]));

  let imported = 0, updated = 0, deleted = 0, skipped = 0;
  const timestamp = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isDelete = row._delete === true;
    const itemCode = normalizeString(row.itemCode).toUpperCase();
    const itemId = codeToId.get(itemCode)!;

    if (isDelete) {
      const bal = await stockService.getBalance(itemId);
      if (bal === 0) {
        skipped++;
        continue;
      }
      // Обнулить через ADJUSTMENT
      await stockService.createAdjustmentOperation({
        itemId,
        quantity: -bal,
        comment: "Setup: обнуление остатка",
        operationKey: `setup-stock-del-${timestamp}-${i}`,
      });
      deleted++;
      continue;
    }

    const mode = normalizeString(row.mode).toLowerCase();
    const qty = normalizeNumber(row.qty)!;

    if (mode === "income") {
      await stockService.createIncomeOperation({
        type: "SUPPLIER_INCOME",
        itemId,
        quantity: qty,
        comment: "Setup: приход",
        operationKey: `setup-stock-${timestamp}-${i}`,
      });
      imported++;
    } else {
      // mode = "set"
      const currentBal = await stockService.getBalance(itemId);
      const delta = qty - currentBal;
      if (delta === 0) {
        skipped++;
        continue;
      }
      await stockService.createAdjustmentOperation({
        itemId,
        quantity: delta,
        comment: `Setup: установка остатка (${currentBal} → ${qty})`,
        operationKey: `setup-stock-${timestamp}-${i}`,
      });
      updated++;
    }
  }

  return { imported, updated, deleted, skipped };
}

// ============================================================
// IMPORT — BOM
// ============================================================

export async function importBom(rows: Record<string, unknown>[]): Promise<ImportResult> {
  const validation = await validateBom(rows);
  if (!validation.valid) {
    throw new ServiceError("Ошибки валидации", 400, validation.errors);
  }

  // Resolve items
  const allItems = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  });
  const codeToId = new Map(allItems.map((it) => [it.code.toUpperCase(), it.id]));

  return prisma.$transaction(async (tx) => {
    let imported = 0, updated = 0, deleted = 0, skipped = 0;

    // Process deletes
    const deleteParents = new Set<string>();
    for (const row of rows) {
      if (row._delete !== true) continue;
      const parentCode = normalizeString(row.parentCode).toUpperCase();
      if (deleteParents.has(parentCode)) continue;
      deleteParents.add(parentCode);

      const parentId = codeToId.get(parentCode)!;

      // Check production orders
      const orderCount = await tx.productionOrder.count({
        where: {
          bom: { itemId: parentId, status: "ACTIVE" },
          status: { in: ["PLANNED", "IN_PROGRESS"] },
        },
      });
      if (orderCount > 0) {
        throw new ServiceError(`Нельзя удалить BOM ${parentCode} — есть активные производственные заказы`, 400);
      }

      // Archive ACTIVE only
      await tx.bom.updateMany({
        where: { itemId: parentId, status: "ACTIVE" },
        data: { status: "ARCHIVED", effectiveTo: new Date() },
      });
      deleted++;
    }

    // Group upsert rows by parentCode
    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      if (row._delete === true) continue;
      const parentCode = normalizeString(row.parentCode).toUpperCase();
      if (!grouped.has(parentCode)) grouped.set(parentCode, []);
      grouped.get(parentCode)!.push(row);
    }

    for (const [parentCode, groupRows] of grouped) {
      const parentId = codeToId.get(parentCode)!;

      // Check if there's existing active BOM
      const existingActive = await tx.bom.findFirst({
        where: { itemId: parentId, status: "ACTIVE" },
      });

      const lines = groupRows.map((row, idx) => {
        const componentCode = normalizeString(row.componentCode).toUpperCase();
        const componentId = codeToId.get(componentCode)!;
        const qty = normalizeNumber(row.qty)!;
        return {
          componentItemId: componentId,
          quantity: qty,
        };
      });

      // Create draft
      const draft = await bomVersionService.createDraft({
        itemId: parentId,
        lines,
      });

      // Activate
      await bomVersionService.activateVersion(draft.id);

      if (existingActive) updated++;
      else imported++;
    }

    return { imported, updated, deleted, skipped };
  });
}

// ============================================================
// IMPORT — Routing
// ============================================================

export async function importRouting(rows: Record<string, unknown>[]): Promise<ImportResult> {
  const validation = await validateRouting(rows);
  if (!validation.valid) {
    throw new ServiceError("Ошибки валидации", 400, validation.errors);
  }

  // Resolve items
  const allItems = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  });
  const codeToId = new Map(allItems.map((it) => [it.code.toUpperCase(), it.id]));

  return prisma.$transaction(async (tx) => {
    let imported = 0, updated = 0, deleted = 0, skipped = 0;

    // Process deletes
    const deleteItemCodes = new Set<string>();
    for (const row of rows) {
      if (row._delete !== true) continue;
      const itemCode = normalizeString(row.itemCode).toUpperCase();
      if (deleteItemCodes.has(itemCode)) continue;
      deleteItemCodes.add(itemCode);

      const itemId = codeToId.get(itemCode)!;

      // Check production operations
      const prodOpCount = await tx.productionOperation.count({
        where: { routingStep: { routing: { itemId, status: "ACTIVE" } } },
      });
      if (prodOpCount > 0) {
        throw new ServiceError(`Нельзя удалить маршрут ${itemCode} — есть производственные операции`, 400);
      }

      // Archive ACTIVE only
      await tx.routing.updateMany({
        where: { itemId, status: "ACTIVE" },
        data: { status: "ARCHIVED" },
      });
      deleted++;
    }

    // Group upsert rows by itemCode → stepNo
    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      if (row._delete === true) continue;
      const itemCode = normalizeString(row.itemCode).toUpperCase();
      if (!grouped.has(itemCode)) grouped.set(itemCode, []);
      grouped.get(itemCode)!.push(row);
    }

    for (const [itemCode, groupRows] of grouped) {
      const itemId = codeToId.get(itemCode)!;

      // Check if there's existing active routing
      const existingActive = await tx.routing.findFirst({
        where: { itemId, status: "ACTIVE" },
      });

      // Group by stepNo
      const stepMap = new Map<number, Record<string, unknown>[]>();
      for (const row of groupRows) {
        const stepNo = normalizeNumber(row.stepNo)!;
        if (!stepMap.has(stepNo)) stepMap.set(stepNo, []);
        stepMap.get(stepNo)!.push(row);
      }

      const stepNos = [...stepMap.keys()].sort((a, b) => a - b);
      const steps = stepNos.map((stepNo) => {
        const stepRows = stepMap.get(stepNo)!;
        const firstRow = stepRows[0];

        const processCode = normalizeString(firstRow.processCode);
        const outputCode = normalizeString(firstRow.outputCode).toUpperCase();
        const outputQty = normalizeNumber(firstRow.outputQty)!;
        const outputItemId = codeToId.get(outputCode)!;

        // Build inputs with sortOrder
        const inputs = stepRows.map((row, idx) => {
          const inputCode = normalizeString(row.inputCode).toUpperCase();
          const inputQty = normalizeNumber(row.inputQty)!;
          const sortOrder = normalizeNumber(row.sortOrder) ?? (idx + 1);
          return {
            itemId: codeToId.get(inputCode)!,
            qty: inputQty,
            sortOrder,
          };
        });

        return {
          stepNo,
          processId: processCode,
          outputItemId,
          outputQty,
          inputs,
        };
      });

      // Archive existing ACTIVE before creating new one
      // (activateRouting checks outputItemId uniqueness before archiving,
      //  so we need to archive first to avoid conflict)
      // Note: using prisma directly because createRouting/activateRouting
      // use their own prisma connections, not the tx from outer transaction
      if (existingActive) {
        await prisma.routing.update({
          where: { id: existingActive.id },
          data: { status: "ARCHIVED" },
        });
      }

      // Create routing via service
      const routing = await routingService.createRouting(itemId, steps);

      // Activate
      await routingService.activateRouting(routing.id);

      if (existingActive) updated++;
      else imported++;
    }

    return { imported, updated, deleted, skipped };
  });
}
