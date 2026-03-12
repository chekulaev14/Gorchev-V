import { z } from "zod";

// --- Row schemas (per tab) ---

export const setupNomenclatureRowSchema = z
  .object({
    code: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    unit: z.string().optional(),
    side: z.string().optional(),
    _delete: z.boolean().optional(),
  })
  .passthrough();

export const setupStockRowSchema = z
  .object({
    itemCode: z.string().optional(),
    qty: z.union([z.string(), z.number()]).optional(),
    mode: z.string().optional(),
    _delete: z.boolean().optional(),
  })
  .passthrough();

export const setupBomRowSchema = z
  .object({
    parentCode: z.string().optional(),
    componentCode: z.string().optional(),
    qty: z.union([z.string(), z.number()]).optional(),
    lineNo: z.union([z.string(), z.number()]).optional(),
    _delete: z.boolean().optional(),
  })
  .passthrough();

export const setupRoutingRowSchema = z
  .object({
    itemCode: z.string().optional(),
    stepNo: z.union([z.string(), z.number()]).optional(),
    processCode: z.string().optional(),
    outputCode: z.string().optional(),
    outputQty: z.union([z.string(), z.number()]).optional(),
    inputCode: z.string().optional(),
    inputQty: z.union([z.string(), z.number()]).optional(),
    sortOrder: z.union([z.string(), z.number()]).optional(),
    _delete: z.boolean().optional(),
  })
  .passthrough();

// --- Tab enum ---

export const setupTabSchema = z.enum(["nomenclature", "stock", "bom", "routing"]);

export type SetupTab = z.infer<typeof setupTabSchema>;

// --- Payload wrapper ---

export const setupPayloadSchema = z.object({
  tab: setupTabSchema,
  rows: z.array(z.record(z.string(), z.unknown())),
});

export type SetupPayload = z.infer<typeof setupPayloadSchema>;

// --- Inferred row types ---

export type SetupNomenclatureRow = z.infer<typeof setupNomenclatureRowSchema>;
export type SetupStockRow = z.infer<typeof setupStockRowSchema>;
export type SetupBomRow = z.infer<typeof setupBomRowSchema>;
export type SetupRoutingRow = z.infer<typeof setupRoutingRowSchema>;

// --- Constants ---

export const MAX_ROWS = 2000;
export const MAX_DISTINCT_ROUTING_ITEMS = 200;
export const MAX_DISTINCT_BOM_PARENTS = 500;

export const VALID_TYPES = ["product", "blank", "material"] as const;
export const VALID_UNITS = ["pcs", "kg", "m"] as const;
export const VALID_SIDES = ["LEFT", "RIGHT", "NONE"] as const;
export const VALID_STOCK_MODES = ["income", "set"] as const;
