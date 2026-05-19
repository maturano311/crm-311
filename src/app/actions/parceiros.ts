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
      )) as sem_visita_15d,
      (SELECT ROUND(AVG(valor_pedido)::numeric, 2) FROM visitas_parceiro WHERE comprou = true AND valor_pedido > 0 AND data_visita >= date_trunc('month', CURRENT_DATE)) as ticket_medio_mes,
      (SELECT ROUND(AVG(valor_pedido)::numeric, 2) FROM visitas_parceiro WHERE comprou = true AND valor_pedido > 0) as ticket_medio_geral
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
    const res = await pool.query(`
      INSERT INTO visitas_parceiro (parceiro_id, tipo_visita, comprou, valor_pedido, observacao)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [data.parceiro_id, data.tipo_visita, data.comprou, data.valor_pedido || null, data.observacao || null]);
    return { success: true, visitaId: res.rows[0]?.id as number };
  } catch (e: any) {
    return { success: false, error: e.message, visitaId: null };
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
// CANCELAR / DEVOLVER VISITA
// ============================================================
export async function cancelarVisita(visitaId: number, status: 'cancelado' | 'devolvido') {
  try {
    await pool.query('UPDATE visitas_parceiro SET status = $2 WHERE id = $1', [visitaId, status]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
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

// Busca TODAS as campanhas (para o painel de gestão)
export async function buscarTodasCampanhas() {
  const res = await pool.query(`
    SELECT 
      c.*,
      (c.data_alvo - CURRENT_DATE) as dias_restantes,
      (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.abordado = true)::INTEGER as total_abordados,
      (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.comprou = true)::INTEGER as total_compraram
    FROM campanhas c
    ORDER BY c.ativa DESC, c.data_alvo ASC
  `);
  return res.rows;
}

// Cria uma campanha manual via interface (sugestão — rede/preço definidos ao ativar)
export async function criarCampanha(data: {
  nome: string;
  data_alvo: string;
  descricao?: string;
  dias_antecedencia?: number;
}) {
  try {
    const res = await pool.query(`
      INSERT INTO campanhas (nome, data_alvo, descricao, dias_antecedencia, ativa)
      VALUES ($1, $2, $3, $4, false)
      RETURNING id, nome, data_alvo, descricao, dias_antecedencia, ativa,
        rede, preco_base, bonificacao_pct, criado_em,
        (data_alvo - CURRENT_DATE)::INTEGER as dias_restantes
    `, [
      data.nome.trim(),
      data.data_alvo,
      data.descricao?.trim() || null,
      data.dias_antecedencia || 7,
    ]);
    return { success: true, campanha: res.rows[0] };
  } catch (e: any) {
    return { success: false, error: e.message, campanha: null };
  }
}

// Ativa campanha com preço e rede (obrigatório)
export async function ativarCampanhaComPreco(id: number, rede: string, preco_base: number, bonificacao_pct: number) {
  try {
    await pool.query(
      `UPDATE campanhas SET ativa = true, rede = $2, preco_base = $3, bonificacao_pct = $4 WHERE id = $1`,
      [id, rede, preco_base, bonificacao_pct]
    );
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Pausa (desativa) uma campanha
export async function toggleCampanhaAtiva(id: number, ativa: boolean) {
  try {
    await pool.query('UPDATE campanhas SET ativa = $2 WHERE id = $1', [id, ativa]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Encerra definitivamente (marca inativa)
export async function encerrarCampanha(id: number) {
  try {
    await pool.query('UPDATE campanhas SET ativa = false WHERE id = $1', [id]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function buscarParticipantesCampanha(campanhaId: number) {
  const res = await pool.query(
    'SELECT parceiro_id, abordado, comprou FROM campanha_parceiros WHERE campanha_id = $1',
    [campanhaId]
  );
  return res.rows;
}

// Todos os parceiros com flag de participação nessa campanha
export async function buscarParceirosComParticipacao(campanhaId: number) {
  const res = await pool.query(`
    SELECT
      p.id,
      p.nome_fantasia,
      p.cidade,
      p.bairro,
      p.regiao,
      p.perfil,
      p.telefone,
      cp.abordado,
      cp.comprou,
      cp.data_abordagem,
      CASE WHEN cp.parceiro_id IS NOT NULL THEN true ELSE false END as na_campanha
    FROM parceiros p
    LEFT JOIN campanha_parceiros cp
      ON cp.parceiro_id = p.id AND cp.campanha_id = $1
    WHERE p.ativo = true
    ORDER BY na_campanha DESC, p.regiao, p.nome_fantasia
  `, [campanhaId]);
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

// Adiciona parceiro à campanha (sem marcar abordado ainda)
export async function adicionarParceiroCampanha(campanhaId: number, parceiroId: number) {
  try {
    await pool.query(`
      INSERT INTO campanha_parceiros (campanha_id, parceiro_id, abordado, comprou)
      VALUES ($1, $2, false, false)
      ON CONFLICT (campanha_id, parceiro_id) DO NOTHING
    `, [campanhaId, parceiroId]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Remove parceiro da campanha
export async function removerParceiroDaCampanha(campanhaId: number, parceiroId: number) {
  try {
    await pool.query(
      'DELETE FROM campanha_parceiros WHERE campanha_id = $1 AND parceiro_id = $2',
      [campanhaId, parceiroId]
    );
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

// ============================================================
// RANKING DE COMPRADORES
// ============================================================
export async function buscarRankingRecorrencia() {
  const res = await pool.query(`
    SELECT
      p.nome_fantasia,
      p.cod_parceiro,
      p.perfil,
      COUNT(*) as total_compras,
      COUNT(*) FILTER (WHERE vp.data_visita >= date_trunc('month', CURRENT_DATE)) as compras_mes,
      MAX(vp.data_visita) as ultima_compra,
      ROUND(AVG(vp.valor_pedido) FILTER (WHERE vp.valor_pedido > 0), 2) as ticket_medio
    FROM visitas_parceiro vp
    JOIN parceiros p ON p.id = vp.parceiro_id
    WHERE vp.comprou = true
    GROUP BY p.id, p.nome_fantasia, p.cod_parceiro, p.perfil
    ORDER BY total_compras DESC
    LIMIT 10
  `);
  return res.rows;
}

// ============================================================
// ATIVAR / DESATIVAR PARCEIRO
// ============================================================
export async function toggleAtivoParceiro(id: number, ativo: boolean) {
  try {
    await pool.query('UPDATE parceiros SET ativo = $2 WHERE id = $1', [id, ativo]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// BUSCAR LEADS PRÓXIMOS (mesmo bairro/cidade do parceiro)
// ============================================================
export async function buscarLeadsPorBairro(cidade: string | null, bairro: string | null) {
  try {
    let query: string;
    let params: any[];

    if (bairro) {
      // Busca pelo bairro usando ILIKE (ignora case e variações)
      query = `
        SELECT id, nome_fantasia, endereco, bairro, cidade, status, prioridade, telefone, nome_contato
        FROM clientes
        WHERE bairro ILIKE $1
          AND status NOT IN ('Cliente', 'Descartado', 'Excluído')
        ORDER BY prioridade DESC, nome_fantasia ASC
        LIMIT 10
      `;
      params = [bairro];
      const res = await pool.query(query, params);
      // Se encontrou resultados, retorna
      if (res.rows.length > 0) return { success: true, data: res.rows };
      // Senão, tenta pela cidade como fallback
    }

    if (cidade) {
      // Fallback: mesma cidade
      query = `
        SELECT id, nome_fantasia, endereco, bairro, cidade, status, prioridade, telefone, nome_contato
        FROM clientes
        WHERE cidade ILIKE $1
          AND status NOT IN ('Cliente', 'Descartado', 'Excluído')
        ORDER BY prioridade DESC, nome_fantasia ASC
        LIMIT 10
      `;
      params = [cidade];
      const res = await pool.query(query, params);
      return { success: true, data: res.rows };
    }

    return { success: true, data: [] };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// DESFAZER VISITA (deleta do banco para undo limpo)
// ============================================================
export async function desfazerVisitaParceiro(visitaId: number, parceiroId: number, comprou: boolean) {
  try {
    await pool.query('DELETE FROM visitas_parceiro WHERE id = $1', [visitaId]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
