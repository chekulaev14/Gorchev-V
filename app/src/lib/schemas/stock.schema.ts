import { z } from "zod";

export const createMovementSchema = z.object({
  action: z.enum(["SUPPLIER_INCOME", "PRODUCTION_INCOME", "ASSEMBLY"]),
  itemId: z.string().uuid("Некорректный ID позиции"),
  quantity: z.number().positive("Количество должно быть больше 0"),
  comment: z.string().optional(),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
