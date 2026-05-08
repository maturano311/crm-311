'use server';

import pool from '@/lib/db';

// ============================================================
// BUSCAR PARCEIROS
// ============================================================
export async function buscarParceiros(filtros?: {
  regiao?: string;
  perfil?: string;
  busca?: string;
  apenasAtivos?: boolean;
}) {
  let where = 'WHERE 1=1';
  const params: any[] = [];
  let i = 1;

  if (filtros?.apenasAtivos !== false) {
    where += ` AND p.ativo = true`;
  }
  if (filtros?.regiao) {
    where += ` AND p.regiao = $${i++}`;
    params.push(filtros.regiao);
  }
  if (filtros?.perfil) {
    where += ` AND p.perfil ILIKE $${i++}`;
    params.push(`%${filtros.perfil}%`);
  }
  if (filtros?.busca) {
    where += ` AND p.nome_fantasia ILIKE $${i++}`;
    params.push(`%${filtros.busca}%`);
  }

  const res = await pool.query(`
    SELECT 
      p.*,
      -- Última visita
      (SELECT data_visita FROM visitas_parceiro WHERE parceiro_id = p.id ORDER BY data_visita DESC LIMIT 1) as ultima_visita,
      -- Última compra
      (SELECT data_visita FROM visitas_parceiro WHERE parceiro_id = p.id AND comprou = true ORDER BY data_visita DESC LIMIT 1) as ultima_compra,
      -- Total visitas este mês
      (SELECT COUNT(*) FROM visitas_parceiro WHERE parceiro_id = p.id AND data_visita >= date_trunc('month', CURRENT_DATE)) as visitas_mes,
      -- Total compras este mês
      (SELECT COUNT(*) FROM visitas_parceiro WHERE parceiro_id = p.id AND comprou = true AND data_visita >= date_trunc('month', CURRENT_DATE)) as compras_mes,
      -- Dias desde última visita
      (SELECT (CURRENT_DATE - MAX(data_visita))::INTEGER FROM visitas_parceiro WHERE parceiro_id = p.id) as dias_sem_visita
    FROM parceiros p
    ${where}
    ORDER BY p.regiao, p.sequencia, p.nome_fantasia
  `, params);

  return res.rows;
}

// ============================================================
// MÉTRICAS GERAIS
// ============================================================
export async function buscarMetricasParceiros() {
  const res = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM parceiros WHERE ativo = true) as total_ativos,
      (SELECT COUNT(DISTINCT vp.parceiro_id) FROM visitas_parceiro vp WHERE vp.data_visita >= date_trunc('month', CURRENT_DATE)) as visitados_mes,
      (SELECT COUNT(DISTINCT vp.parceiro_id) FROM visitas_parceiro vp WHERE vp.comprou = true AND vp.data_visita >= date_trunc('month', CURRENT_DATE)) as compraram_mes,
      (SELECT COUNT(*) FROM parceiros p WHERE p.ativo = true AND NOT EXISTS (
        SELECT 1 FROM visitas_parceiro vp WHERE vp.parceiro_id = p.id AND vp.data_visita >= CURRENT_DATE - INTERVAL '15 days'
      )) as sem_visita_15d
  `);
  return res.rows[0];
}

// ============================================================
// REGISTRAR VISITA
// ============================================================
export async function registrarVisita(data: {
  parceiro_id: number;
  tipo_visita: string;
  comprou: boolean;
  valor_pedido?: number;
  observacao?: string;
}) {
  try {
    await pool.query(`
      INSERT INTO visitas_parceiro (parceiro_id, tipo_visita, comprou, valor_pedido, observacao)
      VALUES ($1, $2, $3, $4, $5)
    `, [data.parceiro_id, data.tipo_visita, data.comprou, data.valor_pedido || null, data.observacao || null]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// HISTÓRICO DE VISITAS
// ============================================================
export async function buscarHistoricoVisitas(parceiroId: number, limite = 20) {
  const res = await pool.query(`
    SELECT * FROM visitas_parceiro 
    WHERE parceiro_id = $1 
    ORDER BY data_visita DESC, criado_em DESC 
    LIMIT $2
  `, [parceiroId, limite]);
  return res.rows;
}

// ============================================================
// ESTATÍSTICAS DE RECORRÊNCIA
// ============================================================
export async function buscarRecorrencia(parceiroId: number) {
  const res = await pool.query(`
    SELECT 
      COUNT(*) as total_visitas,
      COUNT(*) FILTER (WHERE comprou = true) as total_compras,
      MAX(data_visita) as ultima_visita,
      MAX(data_visita) FILTER (WHERE comprou = true) as ultima_compra,
      ROUND(AVG(intervalo)::numeric, 1) as media_dias_entre_compras
    FROM (
      SELECT 
        data_visita,
        comprou,
        data_visita - LAG(data_visita) OVER (ORDER BY data_visita) as intervalo
      FROM visitas_parceiro 
      WHERE parceiro_id = $1 AND comprou = true
    ) sub
  `, [parceiroId]);
  return res.rows[0];
}

// ============================================================
// CAMPANHAS
// ============================================================
export async function buscarCampanhasAtivas() {
  const res = await pool.query(`
    SELECT 
      c.*,
      (c.data_alvo - CURRENT_DATE) as dias_restantes,
      (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.abordado = true) as total_abordados,
      (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.comprou = true) as total_compraram
    FROM campanhas c
    WHERE c.ativa = true AND c.data_alvo >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY c.data_alvo ASC
  `);
  return res.rows;
}

export async function marcarParceiroNaCampanha(campanhaId: number, parceiroId: number, comprou: boolean) {
  try {
    await pool.query(`
      INSERT INTO campanha_parceiros (campanha_id, parceiro_id, abordado, comprou, data_abordagem)
      VALUES ($1, $2, true, $3, CURRENT_DATE)
      ON CONFLICT (campanha_id, parceiro_id) DO UPDATE SET
        abordado = true,
        comprou = $3,
        data_abordagem = CURRENT_DATE
    `, [campanhaId, parceiroId, comprou]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// REGIÕES DISPONÍVEIS (para filtro)
// ============================================================
export async function buscarRegioesParceiros() {
  const res = await pool.query(`
    SELECT DISTINCT regiao FROM parceiros WHERE regiao IS NOT NULL AND ativo = true ORDER BY regiao
  `);
  return res.rows.map((r: any) => r.regiao);
}

// ============================================================
// ATUALIZAR PARCEIRO
// ============================================================
export async function atualizarParceiro(id: number, data: {
  nome_fantasia: string;
  cod_parceiro: number | null;
  regiao: string;
  sequencia: number | null;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  perfil: string;
  tabela_preco: string;
  telefone: string;
  obs_comercial: string;
  obs_loja: string;
}) {
  try {
    await pool.query(`
      UPDATE parceiros SET
        nome_fantasia = $2,
        cod_parceiro = CASE WHEN cod_parceiro IS NULL THEN $3 ELSE cod_parceiro END,
        regiao = NULLIF($4, ''),
        sequencia = $5,
        endereco = NULLIF($6, ''),
        numero = NULLIF($7, ''),
        bairro = NULLIF($8, ''),
        cidade = NULLIF($9, ''),
        perfil = NULLIF($10, ''),
        tabela_preco = NULLIF($11, ''),
        telefone = NULLIF($12, ''),
        obs_comercial = NULLIF($13, ''),
        obs_loja = NULLIF($14, '')
      WHERE id = $1
    `, [id, data.nome_fantasia, data.cod_parceiro || null, data.regiao, data.sequencia || null,
        data.endereco, data.numero, data.bairro, data.cidade, data.perfil,
        data.tabela_preco, data.telefone, data.obs_comercial, data.obs_loja]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// CONVERTER LEAD EM PARCEIRO
// ============================================================
export async function converterLeadEmParceiro(clienteId: number) {
  try {
    // Buscar dados do lead
    const leadRes = await pool.query('SELECT * FROM clientes WHERE id = $1', [clienteId]);
    if (leadRes.rows.length === 0) return { success: false, error: 'Lead não encontrado' };

    const lead = leadRes.rows[0];

    // Verificar se já existe parceiro com esse CNPJ
    if (lead.cnpj) {
      const existe = await pool.query('SELECT id FROM parceiros WHERE cnpj = $1', [lead.cnpj]);
      if (existe.rows.length > 0) {
        return { success: true, parceiro_id: existe.rows[0].id, ja_existia: true };
      }
    }

    // Criar parceiro a partir do lead
    const res = await pool.query(`
      INSERT INTO parceiros (
        nome_fantasia, cnpj, inscricao_estadual, telefone,
        endereco, bairro, cidade,
        lat, lng, perfil, obs_comercial, ativo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING id
    `, [
      lead.nome_fantasia,
      lead.cnpj,
      lead.inscricao_estadual,
      lead.telefone,
      lead.endereco,
      lead.bairro,
      lead.cidade,
      lead.lat || null,
      lead.lng || null,
      lead.tipo || null,
      lead.observacao_atendimento || null
    ]);

    return { success: true, parceiro_id: res.rows[0].id, ja_existia: false };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
