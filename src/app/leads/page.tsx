import pool from '@/lib/db';
import DashboardClient from '../DashboardClient';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  let clientes: any[] = [];
  let metricas = { clientes_ativos: 0, a_prospectar: 0, prioridade_alta: 0, descartados: 0 };
  let prazos: { id: number; descricao: string }[] = [];
  let redes: { id: number; nome: string }[] = [];

  try {
    const clientesRes = await pool.query(`SELECT * FROM clientes WHERE tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE' ORDER BY criado_em DESC`);
    clientes = clientesRes.rows;

    const metricasRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'Cliente' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as clientes_ativos,
        COUNT(*) FILTER (WHERE status = 'Não iniciada' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as a_prospectar,
        COUNT(*) FILTER (WHERE prioridade = 'ALTA' AND status != 'Descartado' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as prioridade_alta,
        COUNT(*) FILTER (WHERE status = 'Descartado' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as descartados
      FROM clientes
    `);
    metricas = {
      clientes_ativos: Number(metricasRes.rows[0].clientes_ativos),
      a_prospectar: Number(metricasRes.rows[0].a_prospectar),
      prioridade_alta: Number(metricasRes.rows[0].prioridade_alta),
      descartados: Number(metricasRes.rows[0].descartados),
    };

    const prazosRes = await pool.query('SELECT id, descricao FROM prazos_pagamento ORDER BY id');
    prazos = prazosRes.rows;

    const redesRes = await pool.query('SELECT id, nome FROM redes ORDER BY nome');
    redes = redesRes.rows;
  } catch (error) {
    console.error('Erro ao buscar dados de leads:', error);
  }

  return (
    <main>
      <DashboardClient clientes={clientes} metricas={metricas} prazos={prazos} redes={redes} />
    </main>
  );
}
