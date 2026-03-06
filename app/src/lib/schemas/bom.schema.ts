import { z } from "zod";

export const addEntrySchema = z.object({
  parentId: z.string().uuid("Некорректный parentId"),
  childId: z.string().uuid("Некорректный childId"),
  quantity: z.number().positive("Количество должно быть больше 0"),
});

export const updateEntrySchema = z.object({
  parentId: z.string().uuid("Некорректный parentId"),
  childId: z.string().uuid("Некорректный childId"),
  quantity: z.number().positive("Количество должно быть больше 0"),
});

export const deleteEntrySchema = z.object({
  parentId: z.string().uuid("Некорректный parentId"),
  childId: z.string().uuid("Некорректный childId"),
});

export type AddEntryInput = z.infer<typeof addEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type DeleteEntryInput = z.infer<typeof deleteEntrySchema>;
