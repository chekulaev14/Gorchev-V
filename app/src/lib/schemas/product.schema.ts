import { z } from "zod";
import { idSchema } from "./helpers";

const componentSchema = z.object({
  tempId: z.string().min(1),
  parentTempId: z.string().min(1),
  existingId: z.preprocess(v => v === "" ? undefined : v, idSchema.optional()),
  name: z.string().trim().min(1, "Название компонента обязательно"),
  type: z.enum(["material", "blank", "product"]),
  unit: z.enum(["kg", "pcs", "m"]).default("pcs"),
  description: z.string().optional(),
  pricePerUnit: z.number().min(0).optional(),
  quantity: z.number().positive("Количество должно быть больше 0"),
  isPaired: z.boolean().optional(),
});

export const createProductSchema = z.object({
  product: z.object({
    name: z.string().trim().min(1, "Название изделия обязательно"),
    unit: z.enum(["kg", "pcs", "m"]).default("pcs"),
    description: z.string().optional(),
  }),
  isPaired: z.boolean().optional().default(false),
  components: z.array(componentSchema),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type ComponentInput = z.infer<typeof componentSchema>;
