import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function resetPrazos() {
  // Limpa prazos antigos (inventados) e insere os corretos do ERP
  await pool.query('DELETE FROM prazos_pagamento');

  const prazos = [
    'A VISTA',
    'A PRAZO 5 DIAS',
    'A PRAZO 12 DIAS',
    'A PRAZO 21 DIAS',
    'A PRAZO 28 DIAS',
    '28 D N ASSINADA',
    '35 D N ASSINADA',
    '45 D N ASSINADA',
    '60 D N ASSINADA',
  ];

  for (const p of prazos) {
    await pool.query('INSERT INTO prazos_pagamento (descricao) VALUES ($1)', [p]);
  }

  const res = await pool.query('SELECT descricao FROM prazos_pagamento ORDER BY id');
  console.log('✅ Prazos atualizados:', res.rows.map(r => r.descricao));
  await pool.end();
}
resetPrazos().catch(console.error);
