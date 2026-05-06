import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const data = '2026-05-06';
  
  // Testa a query original
  const r1 = await pool.query(
    `SELECT id, nome_fantasia, revisitar FROM clientes WHERE revisitar::date = $1::date`,
    [data]
  );
  console.log(`Query original (::date = $1::date) para ${data}: ${r1.rows.length} resultados`);
  r1.rows.forEach(r => console.log(`  ${r.nome_fantasia}: ${r.revisitar}`));

  // Testa a query nova com AT TIME ZONE
  const r2 = await pool.query(
    `SELECT id, nome_fantasia, revisitar FROM clientes WHERE (revisitar AT TIME ZONE 'America/Sao_Paulo')::date = $1::date`,
    [data]
  );
  console.log(`\nQuery com AT TIME ZONE para ${data}: ${r2.rows.length} resultados`);
  r2.rows.forEach(r => console.log(`  ${r.nome_fantasia}: ${r.revisitar}`));

  await pool.end();
}
check().catch(console.error);
