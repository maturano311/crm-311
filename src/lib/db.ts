import { Pool } from 'pg';

let pool: Pool;

if (!global.pgPool) {
  global.pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // número máximo de conexões no pool
  });
}

pool = global.pgPool;

export default pool;

// Type declaration para o global
declare global {
  var pgPool: Pool | undefined;
}
