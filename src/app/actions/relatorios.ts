'use server';

import pool from '@/lib/db';

export async function buscarRelatorios() {
  try {
    // KPIs globais (excluindo descartados, excluídos e CLIENTE_BASE)
    const kpiRes = await pool.query(`
      SELECT
        COUNT(*) as total_ativos,
        COUNT(*) FILTER (WHERE status = 'Não iniciada') as a_prospectar,
        COUNT(*) FILTER (WHERE status = 'Em Andamento') as em_andamento,
        COUNT(*) FILTER (WHERE status = 'Cliente') as clientes,
        COUNT(*) FILTER (WHERE prioridade = 'ALTA' AND status NOT IN ('Cliente')) as alta_ativa,
        COUNT(*) FILTER (WHERE prioridade = 'MEDIA' AND status NOT IN ('Cliente')) as media_ativa,
        COUNT(*) FILTER (WHERE prioridade = 'BAIXA' AND status NOT IN ('Cliente')) as baixa_ativa,
        COUNT(*) FILTER (
          WHERE revisitar IS NULL 
          AND status NOT IN ('Cliente')
        ) as sem_agendamento,
        COUNT(*) FILTER (
          WHERE revisitar IS NOT NULL 
          AND status NOT IN ('Cliente')
        ) as com_agendamento
      FROM clientes
      WHERE status NOT IN ('Descartado', 'Excluído')
      AND COALESCE(tipo_entrada, '') != 'CLIENTE_BASE'
    `);

    // Breakdown por cidade
    const cidadesRes = await pool.query(`
      SELECT
        COALESCE(cidade, 'Sem Cidade') as cidade,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'Não iniciada') as nao_visitado,
        COUNT(*) FILTER (WHERE status = 'Em Andamento') as em_andamento,
        COUNT(*) FILTER (WHERE status = 'Cliente') as clientes,
        COUNT(*) FILTER (WHERE prioridade = 'ALTA' AND status NOT IN ('Cliente')) as alta,
        COUNT(*) FILTER (WHERE prioridade = 'MEDIA' AND status NOT IN ('Cliente')) as media,
        COUNT(*) FILTER (WHERE prioridade = 'BAIXA' AND status NOT IN ('Cliente')) as baixa,
        COUNT(*) FILTER (
          WHERE revisitar IS NULL 
          AND status NOT IN ('Cliente')
        ) as sem_agenda,
        COUNT(*) FILTER (
          WHERE revisitar IS NOT NULL 
          AND status NOT IN ('Cliente')
        ) as com_agenda
      FROM clientes
      WHERE status NOT IN ('Descartado','Excluído')
      AND COALESCE(tipo_entrada, '') != 'CLIENTE_BASE'
      GROUP BY COALESCE(cidade, 'Sem Cidade')
      ORDER BY total DESC
    `);

    return {
      success: true,
      kpi: kpiRes.rows[0],
      cidades: cidadesRes.rows,
    };
  } catch (error: any) {
    console.error('Erro ao buscar relatórios:', error);
    return { success: false, error: error.message, kpi: null, cidades: [] };
  }
}
