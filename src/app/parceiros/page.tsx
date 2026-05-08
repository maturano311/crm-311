import pool from '@/lib/db';
import ParceirosClient from './ParceirosClient';

export const dynamic = 'force-dynamic';

export default async function ParceirosPage() {
  let parceiros: any[] = [];
  let metricas = { total_ativos: 0, visitados_mes: 0, compraram_mes: 0, sem_visita_15d: 0 };
  let regioes: string[] = [];
  let campanhas: any[] = [];
  let tabelas: string[] = [];
  let cidades: string[] = [];

  try {
    // Parceiros com subqueries de recorrência
    const parceirosRes = await pool.query(`
      SELECT 
        p.*,
        (SELECT data_visita FROM visitas_parceiro WHERE parceiro_id = p.id ORDER BY data_visita DESC LIMIT 1) as ultima_visita,
        (SELECT data_visita FROM visitas_parceiro WHERE parceiro_id = p.id AND comprou = true ORDER BY data_visita DESC LIMIT 1) as ultima_compra,
        (SELECT COUNT(*) FROM visitas_parceiro WHERE parceiro_id = p.id AND data_visita >= date_trunc('month', CURRENT_DATE))::INTEGER as visitas_mes,
        (SELECT COUNT(*) FROM visitas_parceiro WHERE parceiro_id = p.id AND comprou = true AND data_visita >= date_trunc('month', CURRENT_DATE))::INTEGER as compras_mes,
        (SELECT (CURRENT_DATE - MAX(data_visita))::INTEGER FROM visitas_parceiro WHERE parceiro_id = p.id) as dias_sem_visita,
        ARRAY(
          SELECT DISTINCT CEIL(EXTRACT(day FROM data_visita) / 7.0)::INTEGER
          FROM visitas_parceiro
          WHERE parceiro_id = p.id
            AND date_trunc('month', data_visita) = date_trunc('month', CURRENT_DATE)
          ORDER BY 1
        ) as semanas_visitadas
      FROM parceiros p
      WHERE p.ativo = true
      ORDER BY p.regiao, p.sequencia, p.nome_fantasia
    `);
    parceiros = parceirosRes.rows;

    // Métricas
    const metricasRes = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM parceiros WHERE ativo = true) as total_ativos,
        (SELECT COUNT(DISTINCT vp.parceiro_id) FROM visitas_parceiro vp WHERE vp.data_visita >= date_trunc('month', CURRENT_DATE)) as visitados_mes,
        (SELECT COUNT(DISTINCT vp.parceiro_id) FROM visitas_parceiro vp WHERE vp.comprou = true AND vp.data_visita >= date_trunc('month', CURRENT_DATE)) as compraram_mes,
        (SELECT COUNT(*) FROM parceiros p WHERE p.ativo = true AND NOT EXISTS (
          SELECT 1 FROM visitas_parceiro vp WHERE vp.parceiro_id = p.id AND vp.data_visita >= CURRENT_DATE - INTERVAL '15 days'
        )) as sem_visita_15d
    `);
    metricas = metricasRes.rows[0];

    // Regiões
    const regioesRes = await pool.query(`
      SELECT DISTINCT regiao FROM parceiros WHERE regiao IS NOT NULL AND ativo = true ORDER BY regiao
    `);
    regioes = regioesRes.rows.map((r: any) => r.regiao);

    // Campanhas ativas (próximas ou recentes)
    const campanhasRes = await pool.query(`
      SELECT 
        c.*,
        (c.data_alvo - CURRENT_DATE) as dias_restantes,
        (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.abordado = true) as total_abordados,
        (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.comprou = true) as total_compraram
      FROM campanhas c
      WHERE c.ativa = true AND c.data_alvo >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY c.data_alvo ASC
      LIMIT 3
    `);
    campanhas = campanhasRes.rows;

    const tabelasRes = await pool.query(`
      SELECT DISTINCT tabela_preco FROM parceiros WHERE tabela_preco IS NOT NULL ORDER BY tabela_preco
    `);
    tabelas = tabelasRes.rows.map((r: any) => r.tabela_preco);

    const cidadesRes = await pool.query(`
      SELECT DISTINCT cidade FROM parceiros WHERE cidade IS NOT NULL ORDER BY cidade
    `);
    cidades = cidadesRes.rows.map((r: any) => r.cidade);

  } catch (error) {
    console.error('Erro ao buscar dados de parceiros:', error);
  }

  return (
    <main>
      <ParceirosClient
        parceiros={parceiros}
        metricas={metricas}
        regioes={regioes}
        campanhas={campanhas}
        tabelas={tabelas}
        cidades={cidades}
      />
    </main>
  );
}
