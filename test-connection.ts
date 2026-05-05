import { Pool } from '@neondatabase/serverless';

// Notice I removed channel_binding=require
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_oeqW7shM3pDb@ep-odd-block-a13wgvy0-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  try {
    const { rows: neonUsers } = await pool.query(`SELECT id, email, name FROM neon_auth.user ORDER BY "createdAt" DESC LIMIT 5`);
    console.log('Neon Auth Users:', neonUsers);

    const { rows: publicUsers } = await pool.query(`SELECT id, email, full_name, created_at FROM public.users ORDER BY created_at DESC LIMIT 5`);
    console.log('Public Users:', publicUsers);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
