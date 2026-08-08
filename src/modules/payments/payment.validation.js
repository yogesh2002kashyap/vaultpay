import { z } from 'zod';

export const checkoutInvoiceParamSchema = z.object({
  params: z.object({
    id: z
      .string({ required_error: 'Invoice ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invoice ID must be a valid MongoDB ObjectId'),
  }),
});
