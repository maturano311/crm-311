import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function queryAll(databaseId: string) {
  const pages: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res = await (notion.search as any)({
      query: '', filter: { value: 'page', property: 'object' }, start_cursor: cursor, page_size: 100,
    });
    const filtered = res.results.filter((p: any) =>
      p.parent?.database_id === databaseId || p.parent?.database_id?.replace(/-/g, '') === databaseId.replace(/-/g, '')
    );
    pages.push(...filtered);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function inspect() {
  const pages = await queryAll(process.env.NOTION_DATABASE_ID!);
  // Pega o primeiro que tem REDE preenchida
  const comRede = pages.find(p => p.properties['REDE']?.rollup?.array?.length > 0);
  if (!comRede) { console.log('Nenhum com REDE preenchida'); return; }

  const rollup = comRede.properties['REDE']?.rollup;
  console.log('REDE rollup completo:');
  console.log(JSON.stringify(rollup, null, 2));
}
inspect().catch(console.error);
