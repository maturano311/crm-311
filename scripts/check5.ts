import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const res = await pool.query(
    "SELECT id, nome_fantasia, revisitar, status FROM clientes WHERE nome_fantasia ILIKE '%Rapozo%' ORDER BY id"
  );
  console.log('Rapozo Filho no banco:');
  res.rows.forEach(r => console.log(`  ID ${r.id} | revisitar: ${r.revisitar} | status: ${r.status}`));

  // Busca todos os clientes com revisitar para o dia 6 de maio (UTC)
  const rota = await pool.query(
    "SELECT id, nome_fantasia, revisitar FROM clientes WHERE revisitar IS NOT NULL ORDER BY revisitar DESC LIMIT 10"
  );
  console.log('\nÚltimos 10 com revisitar:');
  rota.rows.forEach(r => console.log(`  ${r.nome_fantasia}: ${r.revisitar}`));

  await pool.end();
}
check().catch(console.error);
