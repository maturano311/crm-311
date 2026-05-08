import { Pool } from 'pg';

let pool: Pool;

if (!global.pgPool) {
  global.pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });
}

pool = global.pgPool;

export default pool;

// Type declaration para o global
declare global {
  var pgPool: Pool | undefined;
}
