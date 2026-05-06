import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const res = await pool.query("SELECT nome_fantasia, status, tipo_entrada FROM clientes WHERE nome_fantasia ILIKE '%Compre Mais%' OR nome_fantasia ILIKE '%PATY%'");
  console.log(res.rows);
  await pool.end();
}
check();
