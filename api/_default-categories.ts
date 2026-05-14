import { query } from './_db.js'

type DefaultCategory = {
  name: string
  type: 'income' | 'expense'
  color: string
  icon: string
}

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Housing', type: 'expense', color: '#ef4444', icon: 'home' },
  { name: 'Groceries', type: 'expense', color: '#22c55e', icon: 'shopping-cart' },
  { name: 'Dining Out', type: 'expense', color: '#f97316', icon: 'utensils' },
  { name: 'Transportation', type: 'expense', color: '#3b82f6', icon: 'car' },
  { name: 'Utilities', type: 'expense', color: '#eab308', icon: 'zap' },
  { name: 'Healthcare', type: 'expense', color: '#ec4899', icon: 'heart-pulse' },
  { name: 'Entertainment', type: 'expense', color: '#8b5cf6', icon: 'film' },
  { name: 'Shopping', type: 'expense', color: '#06b6d4', icon: 'shopping-bag' },
  { name: 'Subscriptions', type: 'expense', color: '#6366f1', icon: 'repeat' },
  { name: 'Education', type: 'expense', color: '#14b8a6', icon: 'graduation-cap' },
  { name: 'Travel', type: 'expense', color: '#0ea5e9', icon: 'plane' },
  { name: 'Insurance', type: 'expense', color: '#64748b', icon: 'shield' },
  { name: 'Debt Payments', type: 'expense', color: '#dc2626', icon: 'credit-card' },
  { name: 'Savings', type: 'expense', color: '#16a34a', icon: 'piggy-bank' },
  { name: 'Miscellaneous', type: 'expense', color: '#94a3b8', icon: 'tag' },
  { name: 'Salary', type: 'income', color: '#22c55e', icon: 'briefcase' },
  { name: 'Freelance', type: 'income', color: '#14b8a6', icon: 'laptop' },
  { name: 'Business', type: 'income', color: '#0ea5e9', icon: 'building' },
  { name: 'Investments', type: 'income', color: '#8b5cf6', icon: 'trending-up' },
  { name: 'Interest', type: 'income', color: '#84cc16', icon: 'percent' },
  { name: 'Gifts', type: 'income', color: '#ec4899', icon: 'gift' },
  { name: 'Refunds', type: 'income', color: '#f97316', icon: 'rotate-ccw' },
  { name: 'Other Income', type: 'income', color: '#64748b', icon: 'plus-circle' },
]

export async function ensureDefaultCategories(userId: string): Promise<void> {
  const values: unknown[] = [userId]
  const valuePlaceholders = DEFAULT_CATEGORIES.map((category, index) => {
    const baseIndex = index * 4 + 2
    values.push(category.name, category.type, category.color, category.icon)
    return `($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`
  }).join(', ')

  await query(
    `
      INSERT INTO categories (user_id, name, type, color, icon)
      SELECT $1, defaults.name, defaults.type, defaults.color, defaults.icon
      FROM (VALUES ${valuePlaceholders}) AS defaults(name, type, color, icon)
      WHERE NOT EXISTS (
        SELECT 1 FROM categories WHERE user_id = $1
      )
    `,
    values,
  )
}
