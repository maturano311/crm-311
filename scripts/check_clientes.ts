import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const res = await pool.query("SELECT tipo_entrada, COUNT(*) FROM clientes WHERE status = 'Cliente' GROUP BY tipo_entrada;");
  console.table(res.rows);
  pool.end();
}
check();
