import { neon, Pool } from '@neondatabase/serverless'
import type { PoolClient } from '@neondatabase/serverless'

// Use @neondatabase/serverless Pool which handles WebSocket connections internally.
// No custom Client class needed - the Pool manages connections automatically.
let pool: Pool | null = null
let useMock = false

function getPool(): Pool {
  if (pool) return pool

  const connectionString = process.env.NEON_DATABASE_URL
  const useMockExplicitly = process.env.USE_MOCK_DB === 'true'

  if (!connectionString || connectionString === '') {
    if (!useMockExplicitly) {
      throw new Error(
        'NEON_DATABASE_URL is not set. Set USE_MOCK_DB=true explicitly for development without a database, or configure NEON_DATABASE_URL.',
      )
    }
    console.warn('⚠️ Using mock database for development (USE_MOCK_DB=true).')
    useMock = true
    throw new Error('MOCK_MODE')
  }

  // @neondatabase/serverless Pool uses WebSocket connections internally.
  // No need for custom Client or ws polyfill.
  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err)
  })

  return pool
}

export async function query<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  try {
    const dbPool = getPool()
    const result = await dbPool.query<T>(queryText, params ?? [])
    const rows = Array.isArray(result.rows) ? result.rows : []
    const rowCount = typeof result.rowCount === 'number' ? result.rowCount : rows.length
    return { rows, rowCount }
  } catch (error) {
    if (error instanceof Error && error.message === 'MOCK_MODE') {
      const { query: mockQuery } = await import('./_db-mock.js')
      return await mockQuery<T>(queryText, params)
    }
    console.error('Database query error:', error, 'Query:', queryText, 'Params:', params)
    throw error
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

  const dbPool = getPool()
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
