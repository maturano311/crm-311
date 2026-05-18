'use server';

import pool from '@/lib/db';

export async function buscarSubRedes(redeId: number) {
  const res = await pool.query('SELECT id, nome FROM sub_redes WHERE rede_id = $1 ORDER BY nome', [redeId]);
  return res.rows;
}
