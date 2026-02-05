import { Pool, PoolClient } from 'pg'

// Lazy initialization of the pool
let pool: Pool | null = null

function getPool(): Pool {
  if (pool) return pool

  const connectionString = process.env.NEON_DATABASE_URL || process.env.VITE_NEON_DATABASE_URL
  if (!connectionString) {
    throw new Error('Database connection string is missing. Check NEON_DATABASE_URL.')
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: true // Neon requires SSL
    }
  })

  // Error handling for idle clients
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err)
    // Don't exit, just log
  })

  return pool
}

export async function query<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  try {
    const db = getPool()
    const result = await db.query(queryText, params)
    return { rows: result.rows as T[], rowCount: result.rowCount || 0 }
  } catch (error) {
    console.error('Database query error:', error)
    throw error // Re-throw to be handled by the API endpoint
  }
}

export async function queryOne<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<T | null> {
  const { rows } = await query<T>(queryText, params)
  return rows[0] || null
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const db = getPool()
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
