import '../_utils/dns-bypass.js'
import { neon } from '@neondatabase/serverless'

// @neondatabase/serverless HTTP driver - designed for serverless environments like Vercel.
// Each query is a separate HTTP request, but this is the most reliable approach for serverless.
let sql: ReturnType<typeof neon> | null = null

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
    throw new Error('MOCK_MODE')
  }

  sql = neon(connectionString, { fullResults: true })
  return sql
}

// Inlined mock implementations (previously from db-mock.ts, now merged).
// Used only when USE_MOCK_DB=true and no real database is configured.
async function mockQuery<T = unknown>(
  _queryText: string,
  _params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  // Log the SQL text but NOT the params. `auth.service.ts` queries
  // `neon_auth.session WHERE token = $1`, so logging params printed the live
  // session token to stdout. The real path already makes the same call
  // (`db.ts` logs `query` only, never `params`).
  console.log('🏗️ Mock DB: Returning empty results for query:', _queryText)
  return { rows: [], rowCount: 0 }
}

export async function query<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  try {
    const db = getSql()
    const result = (await db.query(queryText, params ?? [])) as any

    const rows = Array.isArray(result.rows) ? (result.rows as T[]) : []
    const rowCount = typeof result.rowCount === 'number' ? result.rowCount : rows.length
    return { rows, rowCount }
  } catch (error) {
    if (error instanceof Error && error.message === 'MOCK_MODE') {
      return await mockQuery<T>(queryText, params)
    }
    console.error('Database query error:', {
      message: error instanceof Error ? error.message : String(error),
      query: queryText.replace(/\s+/g, ' ').trim().slice(0, 200),
    })
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
