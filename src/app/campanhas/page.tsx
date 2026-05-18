import pool from '@/lib/db';
import CampanhasClient from './CampanhasClient';

export const dynamic = 'force-dynamic';

export default async function CampanhasPage() {
  let campanhas: any[] = [];

  try {
    const res = await pool.query(`
      SELECT 
        c.*,
        (c.data_alvo - CURRENT_DATE) as dias_restantes,
        (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.abordado = true)::INTEGER as total_abordados,
        (SELECT COUNT(*) FROM campanha_parceiros cp WHERE cp.campanha_id = c.id AND cp.comprou = true)::INTEGER as total_compraram
      FROM campanhas c
      ORDER BY c.ativa DESC, c.data_alvo ASC
    `);
    campanhas = res.rows;
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error);
  }

  return (
    <main>
      <CampanhasClient campanhas={campanhas} />
    </main>
  );
}
