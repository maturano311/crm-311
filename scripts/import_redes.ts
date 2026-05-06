import { Client } from '@notionhq/client';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const notionToken = process.env.NOTION_TOKEN;
const notion = new Client({ auth: notionToken });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DATABASE_ID = '2a1becc369cf80429280de5fa1725e55';

async function queryAll() {
  const pages: any[] = [];
  let cursor: string | undefined = undefined;
  
  do {
    const res = await (notion.search as any)({
      query: '',
      filter: { value: 'page', property: 'object' },
      start_cursor: cursor,
      page_size: 100,
    });
    const filtered = res.results.filter((p: any) => 
      p.parent?.database_id?.replace(/-/g, '') === DATABASE_ID.replace(/-/g, '')
    );
    pages.push(...filtered);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return pages;
}

// Cache para não buscar a mesma relação duas vezes
const redeNameCache = new Map<string, string>();

async function getNomeRede(relationId: string): Promise<string | null> {
  if (redeNameCache.has(relationId)) return redeNameCache.get(relationId)!;
  try {
    const page = await notion.pages.retrieve({ page_id: relationId }) as any;
    const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
    const nome = titleProp?.title?.[0]?.plain_text?.trim() || null;
    if (nome) redeNameCache.set(relationId, nome);
    return nome;
  } catch { return null; }
}

async function importRedes() {
  console.log('🔍 Buscando Sub Redes no Notion...');
  const pages = await queryAll();
  console.log(`📋 ${pages.length} sub redes encontradas`);

  // Limpa tabelas
  await pool.query('DELETE FROM sub_redes');
  await pool.query('DELETE FROM redes');

  const redeMap = new Map<string, number>(); // nome_rede -> id_no_banco
  let subCount = 0;

  for (const page of pages) {
    const props = page.properties;

    // Nome da sub rede (title = "Descrição (Perfil)")
    const titleProp = Object.values(props).find((p: any) => p.type === 'title') as any;
    const subNome = titleProp?.title?.[0]?.plain_text?.trim();
    if (!subNome) continue;

    // Nome da rede mãe (relation = "Nome da Rede")
    const relationProp = props['Nome da Rede'] as any;
    const relationIds = relationProp?.relation || [];

    if (relationIds.length === 0) {
      // Sem rede mãe definida — trata como rede independente
      if (!redeMap.has(subNome)) {
        const res = await pool.query(
          'INSERT INTO redes (nome) VALUES ($1) ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome RETURNING id',
          [subNome]
        );
        redeMap.set(subNome, res.rows[0].id);
        console.log(`✅ Rede: ${subNome}`);
      }
      continue;
    }

    // Tem rede mãe — busca o nome dela
    const redeNome = await getNomeRede(relationIds[0].id);
    if (!redeNome) continue;

    // Garante que a rede mãe existe no banco
    if (!redeMap.has(redeNome)) {
      const res = await pool.query(
        'INSERT INTO redes (nome) VALUES ($1) ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome RETURNING id',
        [redeNome]
      );
      redeMap.set(redeNome, res.rows[0].id);
      console.log(`✅ Rede: ${redeNome}`);
    }

    const redeId = redeMap.get(redeNome)!;
    await pool.query(
      'INSERT INTO sub_redes (rede_id, nome) VALUES ($1, $2)',
      [redeId, subNome]
    );
    console.log(`  ↳ ${redeNome} > ${subNome}`);
    subCount++;
  }

  const redeCount = await pool.query('SELECT COUNT(*) FROM redes');
  const subTotal = await pool.query('SELECT COUNT(*) FROM sub_redes');
  console.log(`\n✅ Concluído! ${redeCount.rows[0].count} redes | ${subTotal.rows[0].count} sub redes`);
  await pool.end();
}

importRedes().catch(console.error);
