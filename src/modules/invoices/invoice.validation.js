import { z } from 'zod';

/**
 * Invoice Validation Schemas (Zod)
 */

const lineItemSchema = z.object({
  description: z.string().trim().min(1, 'Item description is required'),
  quantity: z.number({ required_error: 'Quantity is required' }).int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number({ required_error: 'Unit price is required' }).min(0, 'Unit price cannot be negative'),
  amount: z.number().min(0).optional(), // Computed server-side; optional in input
});

export const createInvoiceSchema = z.object({
  body: z.object({
    clientId: z
      .string({ required_error: 'Client ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Client ID must be a valid MongoDB ObjectId'),
    items: z
      .array(lineItemSchema, { required_error: 'Items are required' })
      .min(1, 'Invoice must have at least one item'),
    tax: z.number().min(0, 'Tax cannot be negative').default(0),
    currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
    dueDate: z.string({ required_error: 'Due date is required' }).datetime('Due date must be a valid ISO 8601 date'),
    notes: z.string().trim().max(500).optional(),
  }),
});

export const updateInvoiceSchema = z.object({
  body: z.object({
    items: z.array(lineItemSchema).min(1).optional(),
    tax: z.number().min(0).optional(),
    currency: z.enum(['USD', 'EUR', 'GBP']).optional(),
    dueDate: z.string().datetime().optional(),
    notes: z.string().trim().max(500).optional(),
    status: z.enum(['draft', 'pending', 'cancelled']).optional(), // Admin can only manually set limited statuses
  }),
});

export const mongoIdSchema = z.object({
  params: z.object({
    id: z
      .string({ required_error: 'ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'ID must be a valid MongoDB ObjectId'),
  }),
});
