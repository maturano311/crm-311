import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const res = await pool.query("SELECT nome_fantasia, status, tipo_entrada, data_visitacao, revisitar FROM clientes WHERE nome_fantasia ILIKE '%Rapozo%'");
  console.log(res.rows);
  await pool.end();
}
check();
