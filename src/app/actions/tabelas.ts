'use server';

import pool from '@/lib/db';

export async function buscarPrazos() {
  const res = await pool.query('SELECT id, descricao FROM prazos_pagamento ORDER BY id');
  return res.rows;
}

export async function buscarRedes() {
  const res = await pool.query('SELECT id, nome FROM redes ORDER BY nome');
  return res.rows;
}

export async function buscarSubRedes(redeId: number) {
  const res = await pool.query('SELECT id, nome FROM sub_redes WHERE rede_id = $1 ORDER BY nome', [redeId]);
  return res.rows;
}

export async function adicionarRede(nome: string) {
  await pool.query('INSERT INTO redes (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING', [nome]);
}

export async function adicionarSubRede(redeId: number, nome: string) {
  await pool.query('INSERT INTO sub_redes (rede_id, nome) VALUES ($1, $2)', [redeId, nome]);
}
