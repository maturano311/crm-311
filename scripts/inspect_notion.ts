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
      query: '',
      filter: { value: 'page', property: 'object' },
      start_cursor: cursor,
      page_size: 100,
    });
    const filtered = res.results.filter((p: any) =>
      p.parent?.database_id === databaseId ||
      p.parent?.database_id?.replace(/-/g, '') === databaseId.replace(/-/g, '')
    );
    pages.push(...filtered);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function inspect() {
  const databaseId = process.env.NOTION_DATABASE_ID!;
  const pages = await queryAll(databaseId);
  console.log(`Total de páginas: ${pages.length}\n`);

  if (pages.length === 0) return;

  const first = pages[0];
  console.log('=== COLUNAS DISPONÍVEIS ===');
  Object.entries(first.properties).forEach(([key, val]: any) => {
    let sample = '';
    if (val.type === 'title') sample = val.title?.[0]?.plain_text || '(vazio)';
    if (val.type === 'rich_text') sample = val.rich_text?.[0]?.plain_text || '(vazio)';
    if (val.type === 'select') sample = val.select?.name || '(vazio)';
    if (val.type === 'status') sample = val.status?.name || '(vazio)';
    if (val.type === 'relation') sample = `${val.relation?.length || 0} relações`;
    if (val.type === 'rollup') sample = `rollup(${val.rollup?.type})`;
    if (val.type === 'phone_number') sample = val.phone_number || '(vazio)';
    if (val.type === 'email') sample = val.email || '(vazio)';
    if (val.type === 'url') sample = val.url || '(vazio)';
    if (val.type === 'date') sample = val.date?.start || '(vazio)';
    if (val.type === 'checkbox') sample = String(val.checkbox);
    console.log(`  [${val.type.padEnd(12)}] "${key}" = ${sample}`);
  });

  // Mostra amostra dos 5 primeiros com campos importantes
  console.log('\n=== 5 PRIMEIROS LEADS ===');
  for (const page of pages.slice(0, 5)) {
    const p = page.properties;
    const nome = p['NOME FANTASIA']?.title?.[0]?.plain_text || '?';
    const prioridade = p['PRIORIDADE']?.select?.name || '(sem prior)';
    const tipoEntrada = p['TIPO DE ENTRADA']?.select?.name || '(sem tipo)';
    const rede = p['REDE']?.rollup?.array?.[0]?.select?.name 
      || p['REDE']?.rich_text?.[0]?.plain_text 
      || p['REDE']?.select?.name 
      || '(sem rede)';
    console.log(`  ${nome} | ${tipoEntrada} | Prior: ${prioridade} | Rede: ${rede}`);
  }
}

inspect().catch(console.error);
