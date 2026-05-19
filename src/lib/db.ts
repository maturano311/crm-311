import { Pool } from 'pg';

let pool: Pool;

if (!global.pgPool) {
  global.pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: { rejectUnauthorized: false },
  });

  (async () => {
    try {
      const p = global.pgPool!;
      await p.query(`ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS rede TEXT`);
      await p.query(`ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS preco_base NUMERIC(10,2)`);
      await p.query(`ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS bonificacao_pct NUMERIC(5,2)`);
      // Desativa campanhas sem preço/rede configurados (sugestões não confirmadas)
      await p.query(`UPDATE campanhas SET ativa = false WHERE rede IS NULL OR preco_base IS NULL OR bonificacao_pct IS NULL`);
    } catch (e) {
      console.error('Migration campanhas:', e);
    }
  })();
}

pool = global.pgPool;

export default pool;

declare global {
  var pgPool: Pool | undefined;
}
