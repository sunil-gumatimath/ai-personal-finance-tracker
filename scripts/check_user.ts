
import { query } from '../src/lib/neon';

async function check() {
    const email = 'test@example.com'; // Replace with the email you want to check
    try {
        const { rows } = await query('SELECT id, email FROM users WHERE email = $1', [email]);
        console.log('User in DB:', rows);
    } catch (error) {
        console.error('Error checking user:', error);
    }
}

check();
