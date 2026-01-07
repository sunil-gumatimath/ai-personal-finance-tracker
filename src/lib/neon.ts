import { Pool, neon, neonConfig, type PoolClient } from '@neondatabase/serverless';
import ws from 'ws';

// Configure WebSocket for Node.js environment
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

// Get connection string from environment
// Support both Vite (import.meta.env) and Bun/Node (process.env)
const connectionString =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_NEON_DATABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_NEON_DATABASE_URL);

if (!connectionString) {
  console.warn('Neon database URL not found. Please set VITE_NEON_DATABASE_URL in your .env file.');
}

// Create Neon Pool (supports standard query method)
export const pool = connectionString ? new Pool({ connectionString }) : null;
// Export pool as sql for backward compatibility (where it's just checked for existence)
export const sql = pool;

// Helper function for queries with error handling
export async function query<T = unknown>(
  queryText: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  if (!pool) {
    throw new Error('Neon database connection not configured. Please set VITE_NEON_DATABASE_URL.');
  }

  try {
    const result = await pool.query(queryText, params);
    return { rows: result.rows as T[], rowCount: result.rowCount || 0 };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Helper for single row queries
export async function queryOne<T = unknown>(
  queryText: string,
  params?: unknown[]
): Promise<T | null> {
  const { rows } = await query<T>(queryText, params);
  return rows[0] || null;
}

// Helper for transactions
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!pool) {
    throw new Error('Neon database connection not configured.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Export the neon helper too if needed
export { neon };
