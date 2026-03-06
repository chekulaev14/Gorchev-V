import { z } from "zod";

const createAction = z.object({
  action: z.literal("CREATE"),
  itemId: z.string().uuid("Некорректный itemId"),
  quantityPlanned: z.number().positive("Количество должно быть больше 0"),
});

const startAction = z.object({
  action: z.literal("START"),
  orderId: z.string().uuid("Некорректный orderId"),
});

const completeAction = z.object({
  action: z.literal("COMPLETE"),
  orderId: z.string().uuid("Некорректный orderId"),
});

const cancelAction = z.object({
  action: z.literal("CANCEL"),
  orderId: z.string().uuid("Некорректный orderId"),
});

export const productionOrderActionSchema = z.discriminatedUnion("action", [
  createAction,
  startAction,
  completeAction,
  cancelAction,
]);

export type ProductionOrderActionInput = z.infer<typeof productionOrderActionSchema>;
export type CreateOrderInput = z.infer<typeof createAction>;
