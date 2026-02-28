import { Pool, PoolClient } from 'pg'

// Lazy initialization of the pool
let pool: Pool | null = null
let useMock = false

function getPool(): Pool {
  if (pool) return pool

  const connectionString = process.env.NEON_DATABASE_URL
  if (!connectionString) {
    console.warn('⚠️ Database connection string is missing. Using mock database for development.')
    useMock = true
    throw new Error('MOCK_MODE')
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
    if (error instanceof Error && error.message === 'MOCK_MODE') {
      // Use mock database
      const { query: mockQuery } = await import('./_db-mock.js')
      return await mockQuery<T>(queryText, params)
    }
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
  if (useMock) {
    const { transaction: mockTransaction } = await import('./_db-mock.js')
    return await mockTransaction<T>(callback)
  }
  
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
