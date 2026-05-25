'use server';

import pool from '@/lib/db';

// ── Tipos exportados ────────────────────────────────────────────────────────

export type Resumo = {
  total_visitas: number;
  compraram: number;
  nao_compraram: number;
  faturamento_total: number;
  ticket_medio: number;
  taxa_conversao: number;
};

export type ClienteSemVisita = {
  id: number;
  nome_fantasia: string;
  bairro: string | null;
  ultima_visita: string | null;   // 'YYYY-MM-DD' ou null = nunca visitado
  dias_sem_visita: number | null; // null = nunca visitado
};

export type ClienteSemCompra = {
  id: number;
  nome_fantasia: string;
  bairro: string | null;
  ultima_compra: string | null;   // 'YYYY-MM-DD' ou null = nunca comprou
  dias_sem_compra: number | null; // null = nunca comprou
};

export type RankingItem = {
  posicao: number;
  nome_fantasia: string;
  bairro: string | null;
  total_visitas: number;
  total_compras: number;
  faturamento_total: number;
  ticket_medio: number;
};

// ── Helper ───────────────────────────────────────────────────────────────────

function filtroSQL(periodo: string): string {
  switch (periodo) {
    case '7d':   return `AND vp.data_visita >= CURRENT_DATE - INTERVAL '7 days'`;
    case '30d':  return `AND vp.data_visita >= CURRENT_DATE - INTERVAL '30 days'`;
    case 'mes':  return `AND vp.data_visita >= date_trunc('month', CURRENT_DATE)`;
    case 'tudo': return '';
    default:     return `AND vp.data_visita >= CURRENT_DATE - INTERVAL '30 days'`;
  }
}

// ── Action principal ─────────────────────────────────────────────────────────

export async function buscarRelatoriosVendas(periodo: string = '30d') {
  try {
    const filtro = filtroSQL(periodo);

    // ── Bloco 1: Resumo do período ──────────────────────────────────────
    const { rows: [r] } = await pool.query(`
      SELECT
        COUNT(*)                                                               AS total_visitas,
        COUNT(*) FILTER (WHERE comprou = true)                                AS compraram,
        COUNT(*) FILTER (WHERE comprou = false)                               AS nao_compraram,
        COALESCE(SUM(valor_pedido) FILTER (WHERE comprou = true
                                       AND valor_pedido IS NOT NULL), 0)      AS faturamento_total,
        COALESCE(AVG(valor_pedido) FILTER (WHERE comprou = true
                                       AND valor_pedido > 0),           0)    AS ticket_medio
      FROM visitas_parceiro vp
      WHERE 1=1 ${filtro}
    `);

    const totalVisitas = Number(r.total_visitas);
    const compraram    = Number(r.compraram);
    const resumo: Resumo = {
      total_visitas:     totalVisitas,
      compraram,
      nao_compraram:     Number(r.nao_compraram),
      faturamento_total: Number(r.faturamento_total),
      ticket_medio:      Number(r.ticket_medio),
      taxa_conversao:    totalVisitas > 0 ? (compraram / totalVisitas) * 100 : 0,
    };

    // ── Bloco 2: Clientes sem visita há 14+ dias (sempre toda a carteira) ──
    const { rows: svRows } = await pool.query(`
      SELECT
        p.id,
        p.nome_fantasia,
        p.bairro,
        TO_CHAR(MAX(vp.data_visita)::date, 'YYYY-MM-DD')  AS ultima_visita,
        (CURRENT_DATE - MAX(vp.data_visita)::date)::int    AS dias_sem_visita
      FROM parceiros p
      LEFT JOIN visitas_parceiro vp ON vp.parceiro_id = p.id
      WHERE p.ativo = true
      GROUP BY p.id, p.nome_fantasia, p.bairro
      HAVING (
        MAX(vp.data_visita) IS NULL
        OR MAX(vp.data_visita)::date <= CURRENT_DATE - INTERVAL '14 days'
      )
      ORDER BY dias_sem_visita DESC NULLS FIRST
    `);

    const semVisita: ClienteSemVisita[] = svRows.map((row: any) => ({
      id:              row.id,
      nome_fantasia:   row.nome_fantasia,
      bairro:          row.bairro ?? null,
      ultima_visita:   row.ultima_visita ?? null,
      dias_sem_visita: row.dias_sem_visita != null ? Number(row.dias_sem_visita) : null,
    }));

    // ── Bloco 3: Top 15 por faturamento no período ──────────────────────
    const { rows: rkRows } = await pool.query(`
      SELECT
        p.nome_fantasia,
        p.bairro,
        COUNT(*)                                                                     AS total_visitas,
        COUNT(*) FILTER (WHERE vp.comprou = true)                                   AS total_compras,
        COALESCE(SUM(vp.valor_pedido) FILTER (WHERE vp.comprou = true
                                          AND vp.valor_pedido IS NOT NULL), 0)      AS faturamento_total,
        COALESCE(AVG(vp.valor_pedido) FILTER (WHERE vp.comprou = true
                                          AND vp.valor_pedido > 0),         0)      AS ticket_medio
      FROM visitas_parceiro vp
      INNER JOIN parceiros p ON p.id = vp.parceiro_id
      WHERE 1=1 ${filtro}
      GROUP BY p.id, p.nome_fantasia, p.bairro
      ORDER BY faturamento_total DESC NULLS LAST
      LIMIT 15
    `);

    const ranking: RankingItem[] = rkRows.map((row: any, i: number) => ({
      posicao:           i + 1,
      nome_fantasia:     row.nome_fantasia,
      bairro:            row.bairro ?? null,
      total_visitas:     Number(row.total_visitas),
      total_compras:     Number(row.total_compras),
      faturamento_total: Number(row.faturamento_total),
      ticket_medio:      Number(row.ticket_medio),
    }));

    // ── Bloco extra: Visitados sem compra há 14+ dias (toda a carteira) ─
    const { rows: scRows } = await pool.query(`
      SELECT
        p.id,
        p.nome_fantasia,
        p.bairro,
        TO_CHAR(
          MAX(vp.data_visita) FILTER (WHERE vp.comprou = true)::date,
          'YYYY-MM-DD'
        )                                                                    AS ultima_compra,
        (CURRENT_DATE -
          MAX(vp.data_visita) FILTER (WHERE vp.comprou = true)::date
        )::int                                                               AS dias_sem_compra
      FROM parceiros p
      INNER JOIN visitas_parceiro vp ON vp.parceiro_id = p.id
      WHERE p.ativo = true
      GROUP BY p.id, p.nome_fantasia, p.bairro
      HAVING (
        MAX(vp.data_visita) FILTER (WHERE vp.comprou = true) IS NULL
        OR MAX(vp.data_visita) FILTER (WHERE vp.comprou = true)::date
             <= CURRENT_DATE - INTERVAL '14 days'
      )
      ORDER BY dias_sem_compra DESC NULLS FIRST
    `);

    const semCompra: ClienteSemCompra[] = scRows.map((row: any) => ({
      id:              row.id,
      nome_fantasia:   row.nome_fantasia,
      bairro:          row.bairro ?? null,
      ultima_compra:   row.ultima_compra ?? null,
      dias_sem_compra: row.dias_sem_compra != null ? Number(row.dias_sem_compra) : null,
    }));

    return { success: true, resumo, semVisita, semCompra, ranking };
  } catch (error: any) {
    console.error('Erro ao buscar relatórios de vendas:', error);
    return {
      success: false,
      error:     error.message,
      resumo:    null as Resumo | null,
      semVisita: [] as ClienteSemVisita[],
      semCompra: [] as ClienteSemCompra[],
      ranking:   [] as RankingItem[],
    };
  }
}

// ── Visitas do dia ────────────────────────────────────────────────────────────

export type VisitaDoDia = {
  tipo_registro: 'parceiro' | 'lead';
  id: number;
  nome_fantasia: string;
  tipo_visita: string | null;
  comprou: boolean | null;
  valor_pedido: number | null;
  nota: string | null;
};

export async function buscarVisitasDoDia(): Promise<{ success: boolean; data: VisitaDoDia[]; error?: string }> {
  try {
    const [{ rows: parcRows }, { rows: leadRows }] = await Promise.all([
      pool.query(`
        SELECT
          vp.id,
          p.nome_fantasia,
          vp.tipo_visita,
          vp.comprou,
          vp.valor_pedido,
          vp.observacao AS nota
        FROM visitas_parceiro vp
        INNER JOIN parceiros p ON p.id = vp.parceiro_id
        WHERE vp.data_visita = CURRENT_DATE
        ORDER BY vp.id ASC
      `),
      pool.query(`
        SELECT
          id,
          nome_fantasia,
          observacao_atendimento AS nota
        FROM clientes
        WHERE data_visitacao = CURRENT_DATE
        ORDER BY id ASC
      `),
    ]);

    const data: VisitaDoDia[] = [
      ...parcRows.map((r: any) => ({
        tipo_registro: 'parceiro' as const,
        id:            r.id,
        nome_fantasia: r.nome_fantasia,
        tipo_visita:   r.tipo_visita,
        comprou:       r.comprou,
        valor_pedido:  r.valor_pedido != null ? Number(r.valor_pedido) : null,
        nota:          r.nota ?? null,
      })),
      ...leadRows.map((r: any) => ({
        tipo_registro: 'lead' as const,
        id:            r.id,
        nome_fantasia: r.nome_fantasia,
        tipo_visita:   null,
        comprou:       null,
        valor_pedido:  null,
        nota:          r.nota ?? null,
      })),
    ];

    return { success: true, data };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}
