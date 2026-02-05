import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless'
import ws from 'ws'

// Ensure WebSocket is available in Node runtime
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws
}

const connectionString = process.env.NEON_DATABASE_URL || process.env.VITE_NEON_DATABASE_URL

if (!connectionString) {
  console.warn('NEON_DATABASE_URL or VITE_NEON_DATABASE_URL is not set. Database calls will fail.')
}

export const pool = connectionString ? new Pool({ connectionString }) : null

export async function query<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  if (!pool) {
    throw new Error('Neon database connection not configured. Set NEON_DATABASE_URL.')
  }
  const result = await pool.query(queryText, params)
  return { rows: result.rows as T[], rowCount: result.rowCount || 0 }
}

export async function queryOne<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<T | null> {
  const { rows } = await query<T>(queryText, params)
  return rows[0] || null
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!pool) {
    throw new Error('Neon database connection not configured.')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
