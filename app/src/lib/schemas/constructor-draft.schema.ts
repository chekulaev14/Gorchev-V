import { z } from 'zod';

const draftItemSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['material', 'blank', 'product']),
  unit: z.enum(['kg', 'pcs', 'm']),
  side: z.enum(['LEFT', 'RIGHT', 'NONE']),
  pricePerUnit: z.number().nonnegative().optional(),
});

const nodeSchema = z.discriminatedUnion('source', [
  z.object({
    id: z.string().min(1),
    source: z.literal('existing'),
    itemId: z.string().min(1),
    x: z.number(),
    y: z.number(),
    side: z.enum(['LEFT', 'RIGHT', 'NONE']),
  }),
  z.object({
    id: z.string().min(1),
    source: z.literal('new'),
    draftItem: draftItemSchema,
    x: z.number(),
    y: z.number(),
    side: z.enum(['LEFT', 'RIGHT', 'NONE']),
  }),
]);

const edgeSchema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  qty: z.number().positive(),
  sortOrder: z.number().int().min(0),
});

const constructorStateSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  productNodeId: z.string().min(1),
});

export const createDraftSchema = z.object({
  name: z.string().min(1),
  state: constructorStateSchema,
});

export const updateDraftSchema = z.object({
  name: z.string().min(1).optional(),
  state: constructorStateSchema.optional(),
});

export type ConstructorState = z.infer<typeof constructorStateSchema>;
export type CreateDraftInput = z.infer<typeof createDraftSchema>;
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;
