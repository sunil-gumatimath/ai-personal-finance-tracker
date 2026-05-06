import { neon } from '@neondatabase/serverless';

const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'Missing database connection string. Set NEON_DATABASE_URL (preferred) or DATABASE_URL in your environment.',
  );
}

const sql = neon(connectionString);

async function checkSchema() {
  try {
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `;
    console.log('Users table schema:');
    console.log(JSON.stringify(result, null, 2));

    const userCount = await sql`SELECT count(*) FROM users;`;
    console.log('User count:', userCount[0].count);
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkSchema();
