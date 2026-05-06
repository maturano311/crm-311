import pool from '../src/lib/db';
pool.query("SELECT table_name, constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'clientes';")
  .then(res => { console.log(res.rows); pool.end(); })
  .catch(console.error);
