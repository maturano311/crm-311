import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addCopaCampanha() {
  console.log('⚽ Inserindo campanha Copa do Mundo 2026...\n');

  // Verifica se já existe
  const check = await pool.query(
    `SELECT id FROM campanhas WHERE nome ILIKE '%copa%' AND nome ILIKE '%2026%'`
  );

  if (check.rows.length > 0) {
    console.log(`⚠️  Campanha Copa 2026 já existe (id: ${check.rows[0].id}). Nada foi alterado.`);
    await pool.end();
    return;
  }

  // Copa do Mundo 2026: 11 jun - 19 jul 2026 (USA, México e Canadá)
  // Data alvo = abertura em 11/06/2026 | antecedência de 21 dias para ação de campo
  const res = await pool.query(`
    INSERT INTO campanhas (nome, data_alvo, descricao, dias_antecedencia, ativa)
    VALUES ($1, $2, $3, $4, true)
    RETURNING id, nome, data_alvo
  `, [
    'Copa do Mundo 2026 ⚽',
    '2026-06-11',
    'Ação especial Copa do Mundo — aumentar presença nos pontos de venda antes do início dos jogos. Sorvetes e picolés têm alta demanda em datas de jogo. Visitar todos os parceiros e leads para garantir estoque e visibilidade da marca durante o torneio.',
    21,
  ]);

  const c = res.rows[0];
  console.log(`✅ Campanha inserida com sucesso!`);
  console.log(`   ID:        ${c.id}`);
  console.log(`   Nome:      ${c.nome}`);
  console.log(`   Data Alvo: ${new Date(c.data_alvo).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`);
  console.log(`   Antecedência: 21 dias de ação de campo\n`);
  console.log('🎯 A campanha já aparece no Painel Executivo e na aba Campanhas dos Parceiros.');

  await pool.end();
}

addCopaCampanha().catch(e => {
  console.error('❌ Erro:', e);
  process.exit(1);
});
