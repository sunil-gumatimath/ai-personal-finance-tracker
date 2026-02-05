/**
 * Safe query builder utilities to prevent SQL injection
 */

// Allowed column names for each table to prevent SQL injection
const ALLOWED_COLUMNS: Record<string, string[]> = {
  accounts: ['name', 'type', 'balance', 'currency', 'color', 'icon', 'is_active', 'description'],
  transactions: ['type', 'amount', 'description', 'date', 'category_id', 'account_id', 'to_account_id', 'notes'],
  categories: ['name', 'type', 'color', 'icon', 'description'],
  budgets: ['category_id', 'amount', 'period', 'start_date', 'end_date'],
  goals: ['name', 'target_amount', 'current_amount', 'deadline', 'description', 'color', 'icon', 'is_completed'],
  debts: ['name', 'type', 'original_amount', 'current_balance', 'interest_rate', 'minimum_payment', 'due_date', 'lender', 'is_active', 'notes'],
  debt_payments: ['debt_id', 'amount', 'payment_date', 'notes'],
  profiles: ['full_name', 'avatar_url', 'currency', 'preferences'],
  users: ['full_name', 'avatar_url'],
}

/**
 * Validates that column names are allowed for the given table
 */
export function validateColumns(table: string, columns: string[]): string[] {
  const allowed = ALLOWED_COLUMNS[table]
  if (!allowed) {
    throw new Error(`Unknown table: ${table}`)
  }
  
  const invalid = columns.filter(col => !allowed.includes(col))
  if (invalid.length > 0) {
    throw new Error(`Invalid columns for ${table}: ${invalid.join(', ')}`)
  }
  
  return columns
}

/**
 * Builds a safe UPDATE query with parameterized values
 */
export function buildUpdateQuery(
  table: string,
  data: Record<string, unknown>,
  whereClause: string,
  whereParams: unknown[]
): { text: string; values: unknown[] } | null {
  // Filter out user_id and validate columns
  const keys = Object.keys(data).filter(k => k !== 'user_id' && k !== 'id')
  
  if (keys.length === 0) {
    return null // No valid fields to update
  }
  
  // Validate columns against allowed list
  validateColumns(table, keys)
  
  const values = keys.map(k => data[k])
  const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
  
  // Add WHERE params after SET params
  const whereParamOffset = keys.length
  const adjustedWhereClause = whereClause.replace(
    /\$(\d+)/g,
    (_, num) => `$${parseInt(num) + whereParamOffset}`
  )
  
  const text = `UPDATE "${table}" SET ${setClause} WHERE ${adjustedWhereClause} RETURNING *`
  
  return { text, values: [...values, ...whereParams] }
}

/**
 * Builds a safe INSERT query with parameterized values
 */
export function buildInsertQuery(
  table: string,
  data: Record<string, unknown>,
  additionalColumns?: Record<string, unknown>
): { text: string; values: unknown[] } {
  // Filter out user_id from data (it will be added separately)
  const keys = Object.keys(data).filter(k => k !== 'user_id' && k !== 'id')
  
  // Validate columns against allowed list
  validateColumns(table, keys)
  
  const values = keys.map(k => data[k])
  
  // Add additional columns (like user_id)
  if (additionalColumns) {
    Object.entries(additionalColumns).forEach(([key, value]) => {
      keys.push(key)
      values.push(value)
    })
  }
  
  const columns = keys.map(k => `"${k}"`).join(', ')
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
  const text = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING *`
  
  return { text, values }
}
