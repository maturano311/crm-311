import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setup() {
  // Cria tabela de prazos de pagamento
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prazos_pagamento (
      id SERIAL PRIMARY KEY,
      descricao TEXT NOT NULL UNIQUE
    );
  `);

  // Cria tabela de redes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS redes (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE
    );
  `);

  // Cria tabela de sub_redes vinculada às redes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_redes (
      id SERIAL PRIMARY KEY,
      rede_id INTEGER REFERENCES redes(id) ON DELETE CASCADE,
      nome TEXT NOT NULL
    );
  `);

  // Insere os prazos de pagamento reais
  const prazos = [
    'DINHEIRO', 'PIX', 'BOLETO',
    '7 DIAS', '14 DIAS', '21 DIAS', '28 DIAS', '35 DIAS', '42 DIAS',
    '7 / 14 DIAS', '14 / 21 DIAS', '14 / 28 DIAS', '15 / 30 DIAS',
    '21 / 28 DIAS', '28 / 35 DIAS', '28 / 42 DIAS', '30 / 60 DIAS',
    '7 / 14 / 21 DIAS', '14 / 21 / 28 DIAS', '15 / 30 / 45 DIAS',
    '21 / 28 / 35 DIAS', '28 / 35 / 42 DIAS', '30 / 60 / 90 DIAS',
    '7 / 14 / 21 / 28 DIAS', '14 / 21 / 28 / 35 DIAS',
    '21 / 28 / 35 / 42 DIAS', '28 / 35 / 42 / 49 DIAS',
    '30 / 60 / 90 / 120 DIAS', '60 D N ASSINADA'
  ];
  for (const p of prazos) {
    await pool.query(`INSERT INTO prazos_pagamento (descricao) VALUES ($1) ON CONFLICT (descricao) DO NOTHING`, [p]);
  }

  // Insere redes e sub_redes de exemplo (pode editar depois no admin)
  const redesExemplo = ['SUPER', 'REDE MAIS', 'REDE ECONOMIZE', 'SUPERMERCADOS GUARANI', 'INDEPENDENTE'];
  for (const r of redesExemplo) {
    await pool.query(`INSERT INTO redes (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING`, [r]);
  }

  console.log('✅ Tabelas criadas e populadas com sucesso!');

  // Verifica resultado
  const prazosRes = await pool.query('SELECT descricao FROM prazos_pagamento ORDER BY id');
  console.log('Prazos:', prazosRes.rows.map(r => r.descricao));
  const redesRes = await pool.query('SELECT nome FROM redes ORDER BY id');
  console.log('Redes:', redesRes.rows.map(r => r.nome));

  await pool.end();
}
setup().catch(console.error);
