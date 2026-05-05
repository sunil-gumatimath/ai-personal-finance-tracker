import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_oeqW7shM3pDb@ep-odd-block-a13wgvy0-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require' });

async function main() {
  try {
    const { rows: tables } = await pool.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')`);
    console.log('All Tables:', tables);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
