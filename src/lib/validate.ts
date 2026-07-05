/**
 * Shared zod schemas for validating API payloads on the client.
 *
 * Use these in forms before sending data to the API. The same shapes should
 * also be validated server-side (in `api/_lib/utils/`); keeping them in sync
 * here gives early feedback and a single source of truth for the UI.
 */
import { z } from 'zod'

export const emailSchema = z.string().email('Enter a valid email').max(254)
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
export const fullNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name is too long')

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})
export type LoginInput = z.infer<typeof loginSchema>

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
})
export type SignupInput = z.infer<typeof signupSchema>

export const accountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['checking', 'savings', 'credit', 'cash', 'investment', 'other']),
  balance: z.number().finite(),
  currency: z.string().min(1).max(8).default('USD'),
})
export type AccountInput = z.infer<typeof accountSchema>

export const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['income', 'expense']),
  color: z.string().optional(),
  icon: z.string().optional(),
})
export type CategoryInput = z.infer<typeof categorySchema>

export const transactionSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.number().finite().refine((v) => v !== 0, 'Amount cannot be zero'),
  type: z.enum(['income', 'expense', 'transfer']),
  date: z.string().min(1, 'Date is required'),
  description: z.string().max(500).optional(),
})
export type TransactionInput = z.infer<typeof transactionSchema>

export const budgetSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  limit: z.number().positive('Limit must be greater than 0'),
  period: z.enum(['weekly', 'monthly', 'yearly']).default('monthly'),
})
export type BudgetInput = z.infer<typeof budgetSchema>

export const goalSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  targetAmount: z.number().positive('Target must be greater than 0'),
  targetDate: z.string().optional(),
})
export type GoalInput = z.infer<typeof goalSchema>

export const debtSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  balance: z.number().finite(),
  interestRate: z.number().min(0).max(100).default(0),
  minimumPayment: z.number().min(0).default(0),
  dueDate: z.string().optional(),
})
export type DebtInput = z.infer<typeof debtSchema>

/** Convenience: parse and surface the first error message, or null on success. */
export function firstError<T>(schema: z.ZodType<T>, data: unknown): string | null {
  const result = schema.safeParse(data)
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Invalid input'
}
