import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const r = await pool.query(`SELECT prioridade, COUNT(*) as total FROM clientes GROUP BY prioridade ORDER BY total DESC`);
  console.log('Prioridades no banco:');
  r.rows.forEach(row => console.log(`  "${row.prioridade}": ${row.total}`));
  await pool.end();
}
check().catch(console.error);
