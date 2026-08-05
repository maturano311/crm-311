import pool from '@/lib/db';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let leads = {
    total: 0,
    a_prospectar: 0,
    em_andamento: 0,
    clientes: 0,
    descartados: 0,
    prioridade_alta: 0,
    prioridade_media: 0,
    prioridade_baixa: 0,
    agendados_hoje: 0,
  };

  let parceiros = {
    total_ativos: 0,
    visitados_mes: 0,
    compraram_mes: 0,
    sem_visita_15d: 0,
    ticket_medio_mes: null as string | null,
    ticket_medio_geral: null as string | null,
    faturamento_mes: null as string | null,
  };

  let campanhas: {
    id: number;
    nome: string;
    dias_restantes: number;
    total_abordados: number;
    total_compraram: number;
  }[] = [];

  try {
    // Métricas de Leads
    const leadsRes = await pool.query(`
      SELECT
        -- Total SÓ conta leads ativos (exclui descartados e CLIENTE_BASE)
        COUNT(*) FILTER (WHERE status IN ('Não iniciada', 'Em Andamento', 'Cliente') AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as total,
        COUNT(*) FILTER (WHERE status = 'Não iniciada' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as a_prospectar,
        COUNT(*) FILTER (WHERE status = 'Em Andamento' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as em_andamento,
        COUNT(*) FILTER (WHERE status = 'Cliente' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as clientes,
        -- Descartados separado para mini-indicador
        COUNT(*) FILTER (WHERE status = 'Descartado' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as descartados,
        -- Prioridade exclui descartados
        COUNT(*) FILTER (WHERE prioridade = 'ALTA' AND status != 'Descartado' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as prioridade_alta,
        COUNT(*) FILTER (WHERE prioridade = 'MEDIA' AND status != 'Descartado' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as prioridade_media,
        COUNT(*) FILTER (WHERE prioridade = 'BAIXA' AND status != 'Descartado' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as prioridade_baixa,
        COUNT(*) FILTER (WHERE revisitar::date = CURRENT_DATE AND status != 'Descartado' AND tipo_entrada IS DISTINCT FROM 'CLIENTE_BASE') as agendados_hoje
      FROM clientes
    `);
    const l = leadsRes.rows[0];
    leads = {
      total: Number(l.total),
      a_prospectar: Number(l.a_prospectar),
      em_andamento: Number(l.em_andamento),
      clientes: Number(l.clientes),
      descartados: Number(l.descartados),
      prioridade_alta: Number(l.prioridade_alta),
      prioridade_media: Number(l.prioridade_media),
      prioridade_baixa: Number(l.prioridade_baixa),
      agendados_hoje: Number(l.agendados_hoje),
    };

    // Métricas de Parceiros
    const parceirosRes = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM parceiros WHERE ativo = true) as total_ativos,
        (SELECT COUNT(DISTINCT vp.parceiro_id) FROM visitas_parceiro vp WHERE vp.data_visita >= date_trunc('month', CURRENT_DATE)) as visitados_mes,
        (SELECT COUNT(DISTINCT vp.parceiro_id) FROM visitas_parceiro vp WHERE vp.comprou = true AND vp.status = 'confirmado' AND vp.data_visita >= date_trunc('month', CURRENT_DATE)) as compraram_mes,
        (SELECT COUNT(*) FROM parceiros p WHERE p.ativo = true AND NOT EXISTS (
          SELECT 1 FROM visitas_parceiro vp WHERE vp.parceiro_id = p.id AND vp.data_visita >= CURRENT_DATE - INTERVAL '15 days'
        )) as sem_visita_15d,
        (SELECT ROUND(AVG(valor_pedido)::numeric, 2) FROM visitas_parceiro WHERE comprou = true AND status = 'confirmado' AND valor_pedido > 0 AND data_visita >= date_trunc('month', CURRENT_DATE)) as ticket_medio_mes,
        (SELECT ROUND(AVG(valor_pedido)::numeric, 2) FROM visitas_parceiro WHERE comprou = true AND status = 'confirmado' AND valor_pedido > 0) as ticket_medio_geral,
        (SELECT COALESCE(SUM(valor_pedido), 0) FROM visitas_parceiro WHERE comprou = true AND status = 'confirmado' AND valor_pedido > 0 AND data_visita >= date_trunc('month', CURRENT_DATE)) as faturamento_mes
    `);
    const p = parceirosRes.rows[0];
    parceiros = {
      total_ativos: Number(p.total_ativos),
      visitados_mes: Number(p.visitados_mes),
      compraram_mes: Number(p.compraram_mes),
      sem_visita_15d: Number(p.sem_visita_15d),
      ticket_medio_mes: p.ticket_medio_mes,
      ticket_medio_geral: p.ticket_medio_geral,
      faturamento_mes: p.faturamento_mes,
    };

    // Campanhas Ativas
    const campanhasRes = await pool.query(`
      SELECT 
        c.id,
        c.nome,
        (c.data_alvo - CURRENT_DATE) as dias_restantes,
        (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.abordado = true)::INTEGER as total_abordados,
        (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.comprou = true)::INTEGER as total_compraram
      FROM campanhas c
      WHERE c.ativa = true AND c.data_alvo >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY c.data_alvo ASC
      LIMIT 3
    `);
    campanhas = campanhasRes.rows.map((c: any) => ({
      id: c.id,
      nome: c.nome,
      dias_restantes: Number(c.dias_restantes),
      total_abordados: Number(c.total_abordados),
      total_compraram: Number(c.total_compraram),
    }));

  } catch (error) {
    console.error('Erro ao buscar dados da home:', error);
  }

  return (
    <main>
      <HomeClient leads={leads} parceiros={parceiros} campanhas={campanhas} />
    </main>
  );
}

