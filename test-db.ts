import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_oeqW7shM3pDb@ep-odd-block-a13wgvy0-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require' });

async function main() {
  try {
    const { rows: tables } = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log('Tables:', tables.map(t => t.table_name));

    const { rows: users } = await pool.query(`SELECT id, email, full_name FROM users LIMIT 5`);
    console.log('Users:', users);
    
    const { rows: profiles } = await pool.query(`SELECT id, user_id, full_name FROM profiles LIMIT 5`);
    console.log('Profiles:', profiles);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
