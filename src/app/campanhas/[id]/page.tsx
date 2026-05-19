import pool from '@/lib/db';
import { notFound } from 'next/navigation';
import CampanhaDetalheClient from './CampanhaDetalheClient';

export const dynamic = 'force-dynamic';

export default async function CampanhaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campanhaId = Number(id);
  if (isNaN(campanhaId)) notFound();

  let campanha: any = null;
  let parceiros: any[] = [];

  try {
    // Dados da campanha
    const campanhaRes = await pool.query(`
      SELECT
        c.*,
        (c.data_alvo - CURRENT_DATE) as dias_restantes,
        (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.abordado = true)::INTEGER as total_abordados,
        (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.comprou = true)::INTEGER as total_compraram,
        (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id)::INTEGER as total_participantes
      FROM campanhas c
      WHERE c.id = $1
    `, [campanhaId]);

    if (campanhaRes.rows.length === 0) notFound();
    campanha = campanhaRes.rows[0];

    // Todos os parceiros ativos com flag de participação nessa campanha
    const parceirosRes = await pool.query(`
      SELECT
        p.id,
        p.nome_fantasia,
        p.cidade,
        p.bairro,
        p.regiao,
        p.perfil,
        p.telefone,
        p.tabela_preco,
        cp.abordado,
        cp.comprou,
        cp.data_abordagem,
        CASE WHEN cp.parceiro_id IS NOT NULL THEN true ELSE false END as na_campanha
      FROM parceiros p
      LEFT JOIN campanha_parceiros cp
        ON cp.parceiro_id = p.id AND cp.campanha_id = $1
      WHERE p.ativo = true
      ORDER BY na_campanha DESC, p.regiao, p.sequencia, p.nome_fantasia
    `, [campanhaId]);
    parceiros = parceirosRes.rows;

  } catch (error) {
    console.error('Erro ao buscar detalhe da campanha:', error);
  }

  if (!campanha) notFound();

  return (
    <main>
      <CampanhaDetalheClient campanha={campanha} parceiros={parceiros} />
    </main>
  );
}
