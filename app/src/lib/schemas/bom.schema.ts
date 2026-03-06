import { z } from "zod";
import { idSchema } from "./helpers";

export const addEntrySchema = z.object({
  parentId: idSchema,
  childId: idSchema,
  quantity: z.number().positive("Количество должно быть больше 0"),
});

export const updateEntrySchema = z.object({
  parentId: idSchema,
  childId: idSchema,
  quantity: z.number().positive("Количество должно быть больше 0"),
});

export const deleteEntrySchema = z.object({
  parentId: idSchema,
  childId: idSchema,
});

export type AddEntryInput = z.infer<typeof addEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type DeleteEntryInput = z.infer<typeof deleteEntrySchema>;
