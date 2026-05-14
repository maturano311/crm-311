const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.ovavpzbplqcojozpbmhi:8jSWH4Q9GkV4vbZA@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
pool.query("ALTER TABLE visitas_parceiro ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'confirmado'")
  .then(() => { console.log('Migration OK'); pool.end(); })
  .catch(e => { console.error('Erro:', e.message); pool.end(); });
