import { Pool } from 'pg';

let pool: Pool;

if (!global.pgPool) {
  global.pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: { rejectUnauthorized: false },
  });

  global.pgPool.on('connect', (client) => {
    client.query("SET timezone = 'America/Sao_Paulo'");
  });

  (async () => {
    const p = global.pgPool!;
    try {
      await p.query(`ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS rede TEXT`);
      await p.query(`ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS preco_base NUMERIC(10,2)`);
      await p.query(`ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS bonificacao_pct NUMERIC(5,2)`);
      await p.query(`
        CREATE TABLE IF NOT EXISTS campanha_precos (
          id SERIAL PRIMARY KEY,
          campanha_id INTEGER NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
          rede TEXT NOT NULL,
          preco_base NUMERIC(10,2) NOT NULL,
          bonificacao_pct NUMERIC(5,2) NOT NULL,
          UNIQUE(campanha_id, rede)
        )
      `);
      // Migra dados existentes de campanhas para campanha_precos
      await p.query(`
        INSERT INTO campanha_precos (campanha_id, rede, preco_base, bonificacao_pct)
        SELECT id, rede, preco_base, bonificacao_pct FROM campanhas
        WHERE rede IS NOT NULL AND preco_base IS NOT NULL AND bonificacao_pct IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
    } catch (e) {
      console.error('Migration campanhas:', e);
    }

    try {
      await p.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS segmento TEXT`);
    } catch (e) {
      console.error('Migration clientes segmento:', e);
    }

    try {
      await p.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7)`);
      await p.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7)`);
    } catch (e) {
      console.error('Migration clientes lat/lng:', e);
    }

    try {
      const tabelas = [
        'clientes', 'parceiros', 'visitas_parceiro', 'campanhas',
        'campanha_precos', 'campanha_parceiros', 'compras',
        'prazos_pagamento', 'redes', 'sub_redes',
      ];
      for (const tabela of tabelas) {
        await p.query(`ALTER TABLE ${tabela} ENABLE ROW LEVEL SECURITY`);
      }
    } catch (e) {
      console.error('Migration RLS:', e);
    }
  })();
}

pool = global.pgPool;

export default pool;

declare global {
  var pgPool: Pool | undefined;
}
