import { z } from "zod";

const stepInputSchema = z.object({
  itemId: z.string().min(1),
  qty: z.number().positive(),
  sortOrder: z.number().int().min(0),
});

const stepSchema = z.object({
  stepNo: z.number().int().min(1),
  processId: z.string().min(1),
  outputItemId: z.string().min(1),
  outputQty: z.number().positive(),
  inputs: z.array(stepInputSchema).min(1),
  normTimeMin: z.number().positive().optional(),
  setupTimeMin: z.number().positive().optional(),
  note: z.string().optional(),
});

export const createRoutingSchema = z.object({
  itemId: z.string().min(1),
  steps: z.array(stepSchema).min(1),
});

export const updateRoutingStepsSchema = z.object({
  steps: z.array(stepSchema).min(1),
});

export type StepInputPayload = z.infer<typeof stepInputSchema>;
export type StepPayload = z.infer<typeof stepSchema>;
export type CreateRoutingInput = z.infer<typeof createRoutingSchema>;
export type UpdateRoutingStepsInput = z.infer<typeof updateRoutingStepsSchema>;
