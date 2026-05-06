import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  // Lista todas as tabelas
  const tabelas = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('TABELAS:', tabelas.rows.map(r => r.table_name));
  
  // Verifica um cliente com revisitar definido
  const rota = await pool.query("SELECT id, nome_fantasia, revisitar FROM clientes WHERE revisitar IS NOT NULL LIMIT 3");
  console.log('CLIENTES COM REVISITAR:', rota.rows);

  await pool.end();
}
check();
