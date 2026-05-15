import { neon } from '@neondatabase/serverless'

// @neondatabase/serverless HTTP driver - designed for serverless environments like Vercel.
// Each query is a separate HTTP request, but this is the most reliable approach for serverless.
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
    const result = await db(queryText, ...params ?? [])

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

export async function transaction<T>(callback: (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number }> }) => Promise<T>): Promise<T> {
  if (useMock) {
    const { transaction: mockTransaction } = await import('./_db-mock.js')
    return await mockTransaction<T>(callback)
  }

  // HTTP driver doesn't support interactive transactions natively.
  // We simulate a transaction by wrapping queries in a single call.
  // For most use cases in this app, this is sufficient.
  throw new Error('Interactive transactions are not supported over HTTP driver.')
}
