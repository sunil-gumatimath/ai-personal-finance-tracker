/**
 * Database Adapter
 * 
 * This file provides a unified interface for database operations using Neon.
 */

import { query as neonQuery, queryOne as neonQueryOne, sql } from './neon';

/**
 * Unified query function
 */
export async function query<T = unknown>(
  queryText: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  return neonQuery<T>(queryText, params);
}

/**
 * Query single row
 */
export async function queryOne<T = unknown>(
  queryText: string,
  params?: unknown[]
): Promise<T | null> {
  return neonQueryOne<T>(queryText, params);
}

/**
 * Get database client
 */
export function getDatabaseClient() {
  return { type: 'neon', client: sql };
}

/**
 * Helper to check if using Neon
 */
export const isUsingNeon = () => !!sql;

/**
 * Helper to get user ID from current session
 */
export async function getCurrentUserId(): Promise<string | null> {
  // Placeholder until new auth is implemented
  // Returns a consistent ID for data association in this demo/migration phase
  const userItem = localStorage.getItem('finance_user');
  if (userItem) {
    try {
      const user = JSON.parse(userItem);
      return user.id;
    } catch (e) {
      console.error('Error parsing user from local storage:', e);
    }
  }
  // Return null if no user is found, requiring the user to log in
  return null;
}

// Helper to construct and execute INSERT queries
export async function insertRecord<T = unknown>(table: string, data: Record<string, unknown>): Promise<T> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const columns = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

  const text = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
  const { rows } = await query<T>(text, values);
  return rows[0];
}

// Helper to construct and execute UPDATE queries
export async function updateRecord<T = unknown>(table: string, id: string, data: Record<string, unknown>): Promise<T> {
  const keys = Object.keys(data);
  const values = Object.values(data);

  // Create "col = $1, col2 = $2"
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

  // Add ID as the last parameter
  const text = `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
  const { rows } = await query<T>(text, [...values, id]);
  return rows[0];
}

// Helper for DELETE
export async function deleteRecord(table: string, id: string): Promise<void> {
  await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}


export { sql as neonSql };
