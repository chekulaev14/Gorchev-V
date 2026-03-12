import { z } from "zod";

export const terminalProduceSchema = z.object({
  itemId: z.string().min(1),
  workers: z
    .array(
      z.object({
        workerId: z.string().min(1),
        quantity: z.number().positive(),
      }),
    )
    .min(1),
  clientOperationKey: z.string().min(1).optional(),
});

export type TerminalProduceInput = z.infer<typeof terminalProduceSchema>;
