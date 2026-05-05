import { PoolClient } from '@neondatabase/serverless'

export async function query<T = unknown>(_queryText: string, _params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> {
  console.log('🏗️ Mock DB: Returning empty results for query:', _queryText)
  return { rows: [], rowCount: 0 }
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  console.log('🏗️ Mock DB: Simulating transaction...')
  const mockClient = {
    query: async () => ({ rows: [], rowCount: 0 }),
    release: () => {},
  } as unknown as PoolClient
  return await callback(mockClient)
}
