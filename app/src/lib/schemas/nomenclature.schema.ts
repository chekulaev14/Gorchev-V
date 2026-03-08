import { z } from "zod";

export const createItemSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно"),
  typeId: z.enum(["material", "blank", "product"]).optional().default("material"),
  unitId: z.enum(["kg", "pcs", "m"]).optional().default("pcs"),
  categoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  pricePerUnit: z.number().min(0, "Цена не может быть отрицательной").nullable().optional(),
  weight: z.number().positive("Вес должен быть положительным").nullable().optional(),
});

export const updateItemSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно").optional(),
  typeId: z.enum(["material", "blank", "product"]).optional(),
  unitId: z.enum(["kg", "pcs", "m"]).optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  pricePerUnit: z.number().min(0, "Цена не может быть отрицательной").nullable().optional(),
  weight: z.number().positive("Вес должен быть положительным").nullable().optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
