import { z } from "zod";
import { idSchema } from "./helpers";

const createAction = z.object({
  action: z.literal("CREATE"),
  itemId: idSchema,
  quantityPlanned: z.number().positive("Количество должно быть больше 0"),
});

const startAction = z.object({
  action: z.literal("START"),
  orderId: idSchema,
});

const completeAction = z.object({
  action: z.literal("COMPLETE"),
  orderId: idSchema,
});

const cancelAction = z.object({
  action: z.literal("CANCEL"),
  orderId: idSchema,
});

export const productionOrderActionSchema = z.discriminatedUnion("action", [
  createAction,
  startAction,
  completeAction,
  cancelAction,
]);

export type ProductionOrderActionInput = z.infer<typeof productionOrderActionSchema>;
export type CreateOrderInput = z.infer<typeof createAction>;
