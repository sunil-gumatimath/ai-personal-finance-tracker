import { neon } from '@neondatabase/serverless'
import type { PoolClient } from '@neondatabase/serverless'

type QueryResult<T> = T[] | { rows: T[]; rowCount?: number }
type UnsafeSql = ReturnType<typeof neon> & {
  unsafe: <T = unknown>(queryText: string, params: unknown[]) => Promise<QueryResult<T>>
}

function hasRows<T>(result: QueryResult<T>): result is { rows: T[]; rowCount?: number } {
  return !Array.isArray(result) && Array.isArray(result.rows)
}

// Use fetch for serverless environments (HTTP driver)
// No WebSocket polyfill needed for HTTP

let sql: ReturnType<typeof neon> | null = null
let useMock = false

function getSql(): ReturnType<typeof neon> {
  if (sql) return sql

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

  sql = neon(connectionString, { fullResults: true })
  return sql
}

export async function query<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  try {
    const db = getSql()
    // `neon()` returns a tagged-template function; for dynamic SQL strings use `unsafe`.
    const result = await (db as UnsafeSql).unsafe<T>(queryText, params ?? [])

    const rows = hasRows(result) ? result.rows : (Array.isArray(result) ? result : [])
    const rowCount = hasRows(result) && typeof result.rowCount === 'number' ? result.rowCount : rows.length

    return { rows, rowCount }
  } catch (error) {
    if (error instanceof Error && error.message === 'MOCK_MODE') {
      // Use mock database
      const { query: mockQuery } = await import('./_db-mock.js')
      return await mockQuery<T>(queryText, params)
    }
    console.error('Database query error:', error, 'Query:', queryText, 'Params:', params)
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

  // Interactive transactions are not supported by the HTTP driver in the same way.
  // Since this app currently doesn't use them, we will just throw an error or mock it.
  throw new Error('Interactive transactions are not supported over HTTP driver.')
}
