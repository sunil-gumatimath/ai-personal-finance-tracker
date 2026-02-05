import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless'

// Configure WebSocket and create connection pool
let pool: Pool | null = null
let initPromise: Promise<void> | null = null

async function initializePool() {
  if (pool) return

  // Configure WebSocket for Node.js environments (local development with Bun)
  // In Vercel serverless, native WebSocket is available
  if (typeof globalThis.WebSocket === 'undefined') {
    try {
      const ws = await import('ws')
      neonConfig.webSocketConstructor = ws.default
    } catch {
      // WebSocket not available - Neon will use HTTP fallback
      console.warn('WebSocket not available, using HTTP fallback')
    }
  }

  const connectionString = process.env.NEON_DATABASE_URL || process.env.VITE_NEON_DATABASE_URL

  if (!connectionString) {
    console.warn('NEON_DATABASE_URL or VITE_NEON_DATABASE_URL is not set. Database calls will fail.')
    return
  }

  pool = new Pool({ connectionString })
}

// Ensure pool is initialized before use
async function getPool(): Promise<Pool> {
  if (!initPromise) {
    initPromise = initializePool()
  }
  await initPromise

  if (!pool) {
    throw new Error('Neon database connection not configured. Set NEON_DATABASE_URL.')
  }

  return pool
}

export async function query<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  const db = await getPool()
  const result = await db.query(queryText, params)
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
  const db = await getPool()

  const client = await db.connect()
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
