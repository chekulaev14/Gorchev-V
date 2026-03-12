import { z } from "zod";

const bomLineSchema = z.object({
  componentItemId: z.string().min(1),
  quantity: z.number().positive(),
  scrapFactor: z.number().min(0).optional(),
  note: z.string().optional(),
});

export const createBomDraftSchema = z.object({
  itemId: z.string().min(1),
  lines: z.array(bomLineSchema).min(1),
});

export const updateBomDraftSchema = z.object({
  lines: z.array(bomLineSchema).min(1),
});

export type CreateBomDraftInput = z.infer<typeof createBomDraftSchema>;
export type UpdateBomDraftInput = z.infer<typeof updateBomDraftSchema>;
