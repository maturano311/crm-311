import pool from '@/lib/db';
import DashboardClient from './DashboardClient';

export default async function Home() {
  let clientes: any[] = [];
  let metricas = { clientes_ativos: 0, a_prospectar: 0, prioridade_alta: 0 };
  let prazos: { id: number; descricao: string }[] = [];
  let redes: { id: number; nome: string }[] = [];

  try {
    const clientesRes = await pool.query(`SELECT * FROM clientes ORDER BY criado_em DESC`);
    clientes = clientesRes.rows;

    const metricasRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'Cliente') as clientes_ativos,
        COUNT(*) FILTER (WHERE tipo_entrada = 'A PROSPECTAR') as a_prospectar,
        COUNT(*) FILTER (WHERE prioridade = 'ALTA') as prioridade_alta
      FROM clientes
    `);
    metricas = metricasRes.rows[0];

    const prazosRes = await pool.query('SELECT id, descricao FROM prazos_pagamento ORDER BY id');
    prazos = prazosRes.rows;

    const redesRes = await pool.query('SELECT id, nome FROM redes ORDER BY nome');
    redes = redesRes.rows;
  } catch (error) {
    console.error('Erro ao buscar dados iniciais:', error);
  }

  return (
    <main>
      <DashboardClient clientes={clientes} metricas={metricas} prazos={prazos} redes={redes} />
    </main>
  );
}
