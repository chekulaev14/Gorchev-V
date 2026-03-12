import { describe, it, expect } from "vitest";
import {
  setupNomenclatureRowSchema,
  setupStockRowSchema,
  setupBomRowSchema,
  setupRoutingRowSchema,
  setupPayloadSchema,
  setupTabSchema,
} from "@/lib/schemas/setup-import.schema";

// ============================================================
// Tab enum
// ============================================================

describe("setupTabSchema", () => {
  it("valid tabs", () => {
    for (const tab of ["nomenclature", "stock", "bom", "routing"]) {
      expect(setupTabSchema.safeParse(tab).success).toBe(true);
    }
  });

  it("invalid tab", () => {
    expect(setupTabSchema.safeParse("invalid").success).toBe(false);
    expect(setupTabSchema.safeParse("").success).toBe(false);
    expect(setupTabSchema.safeParse(123).success).toBe(false);
  });
});

// ============================================================
// Payload wrapper
// ============================================================

describe("setupPayloadSchema", () => {
  it("valid payload", () => {
    const result = setupPayloadSchema.safeParse({
      tab: "nomenclature",
      rows: [{ name: "Test" }],
    });
    expect(result.success).toBe(true);
  });

  it("missing tab", () => {
    const result = setupPayloadSchema.safeParse({ rows: [] });
    expect(result.success).toBe(false);
  });

  it("missing rows", () => {
    const result = setupPayloadSchema.safeParse({ tab: "nomenclature" });
    expect(result.success).toBe(false);
  });

  it("invalid tab value", () => {
    const result = setupPayloadSchema.safeParse({ tab: "bad", rows: [] });
    expect(result.success).toBe(false);
  });

  it("empty rows array is valid (length check is in route, not schema)", () => {
    const result = setupPayloadSchema.safeParse({ tab: "stock", rows: [] });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Nomenclature row
// ============================================================

describe("setupNomenclatureRowSchema", () => {
  it("full valid row", () => {
    const result = setupNomenclatureRowSchema.safeParse({
      code: "BLK-001", name: "Test", type: "blank", unit: "pcs", side: "NONE",
    });
    expect(result.success).toBe(true);
  });

  it("all fields optional", () => {
    const result = setupNomenclatureRowSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("_delete flag", () => {
    const result = setupNomenclatureRowSchema.safeParse({ _delete: true, code: "BLK-001" });
    expect(result.success).toBe(true);
  });

  it("passthrough unknown fields", () => {
    const result = setupNomenclatureRowSchema.safeParse({ name: "Test", _fromDb: true, _custom: 42 });
    expect(result.success).toBe(true);
  });

  it("_delete must be boolean", () => {
    const result = setupNomenclatureRowSchema.safeParse({ _delete: "true" });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Stock row
// ============================================================

describe("setupStockRowSchema", () => {
  it("qty as number", () => {
    const result = setupStockRowSchema.safeParse({ itemCode: "MAT-001", qty: 10, mode: "income" });
    expect(result.success).toBe(true);
  });

  it("qty as string (Excel paste)", () => {
    const result = setupStockRowSchema.safeParse({ itemCode: "MAT-001", qty: "10.5", mode: "set" });
    expect(result.success).toBe(true);
  });

  it("all fields optional", () => {
    expect(setupStockRowSchema.safeParse({}).success).toBe(true);
  });
});

// ============================================================
// BOM row
// ============================================================

describe("setupBomRowSchema", () => {
  it("full valid row", () => {
    const result = setupBomRowSchema.safeParse({
      parentCode: "PRD-001", componentCode: "BLK-001", qty: 2, lineNo: 1,
    });
    expect(result.success).toBe(true);
  });

  it("lineNo optional", () => {
    const result = setupBomRowSchema.safeParse({
      parentCode: "PRD-001", componentCode: "BLK-001", qty: 2,
    });
    expect(result.success).toBe(true);
  });

  it("qty as string", () => {
    const result = setupBomRowSchema.safeParse({
      parentCode: "PRD-001", componentCode: "BLK-001", qty: "3.5",
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Routing row
// ============================================================

describe("setupRoutingRowSchema", () => {
  it("full valid row", () => {
    const result = setupRoutingRowSchema.safeParse({
      itemCode: "PRD-001", stepNo: 1, processCode: "cutting",
      outputCode: "PRD-001", outputQty: 1,
      inputCode: "MAT-001", inputQty: 0.5, sortOrder: 1,
    });
    expect(result.success).toBe(true);
  });

  it("sortOrder optional", () => {
    const result = setupRoutingRowSchema.safeParse({
      itemCode: "PRD-001", stepNo: 1, processCode: "cutting",
      outputCode: "PRD-001", outputQty: 1,
      inputCode: "MAT-001", inputQty: 0.5,
    });
    expect(result.success).toBe(true);
  });

  it("numeric fields as strings", () => {
    const result = setupRoutingRowSchema.safeParse({
      itemCode: "PRD-001", stepNo: "1", processCode: "cutting",
      outputCode: "PRD-001", outputQty: "1",
      inputCode: "MAT-001", inputQty: "0.5", sortOrder: "1",
    });
    expect(result.success).toBe(true);
  });

  it("_delete with only itemCode", () => {
    const result = setupRoutingRowSchema.safeParse({ _delete: true, itemCode: "PRD-001" });
    expect(result.success).toBe(true);
  });
});
