import { z } from "zod";

export const createGroupSchema = z.object({
  type: z.literal("group"),
  name: z.string().trim().min(1, "Название обязательно"),
  id: z.string().trim().optional(),
  order: z.number().int().optional(),
});

export const createProcessSchema = z.object({
  type: z.literal("process").optional().default("process"),
  name: z.string().trim().min(1, "Название обязательно"),
  groupId: z.string().trim().min(1, "Группа обязательна"),
});

export const createProcessPostSchema = z.discriminatedUnion("type", [
  createGroupSchema,
  z.object({
    type: z.literal("process"),
    name: z.string().trim().min(1, "Название обязательно"),
    groupId: z.string().trim().min(1, "Группа обязательна"),
  }),
]);

export const updateProcessSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("process"),
    id: z.string().min(1, "id обязателен"),
    name: z.string().trim().min(1, "Название обязательно"),
  }),
  z.object({
    type: z.literal("group"),
    id: z.string().min(1, "id обязателен"),
    name: z.string().trim().min(1, "Название обязательно"),
  }),
]);

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type CreateProcessPostInput = z.infer<typeof createProcessPostSchema>;
export type UpdateProcessInput = z.infer<typeof updateProcessSchema>;
