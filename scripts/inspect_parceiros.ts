import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
const notion = new Client({ auth: process.env.NOTION_TOKEN });

const PARCEIROS_DB_ID = '2acbecc369cf8071894cc643bb8a9aa3';

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
      p.parent?.database_id?.replace(/-/g, '') === PARCEIROS_DB_ID.replace(/-/g, '')
    );
    pages.push(...filtered);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function inspect() {
  const pages = await queryAll();
  console.log(`Total de páginas no DB Parceiros: ${pages.length}\n`);

  if (pages.length === 0) return;

  const first = pages[0];
  console.log('=== SCHEMA COMPLETO ===');
  Object.entries(first.properties).forEach(([key, val]: any) => {
    let sample = '';
    if (val.type === 'title') sample = val.title?.[0]?.plain_text || '(vazio)';
    if (val.type === 'rich_text') sample = val.rich_text?.[0]?.plain_text || '(vazio)';
    if (val.type === 'select') sample = val.select?.name || '(vazio)';
    if (val.type === 'status') sample = val.status?.name || '(vazio)';
    if (val.type === 'relation') sample = `${val.relation?.length || 0} relações`;
    if (val.type === 'rollup') sample = JSON.stringify(val.rollup).substring(0, 200);
    if (val.type === 'phone_number') sample = val.phone_number || '(vazio)';
    if (val.type === 'email') sample = val.email || '(vazio)';
    if (val.type === 'url') sample = val.url || '(vazio)';
    if (val.type === 'date') sample = val.date?.start || '(vazio)';
    if (val.type === 'checkbox') sample = String(val.checkbox);
    if (val.type === 'number') sample = String((val.number ?? '(vazio)'));
    if (val.type === 'multi_select') sample = val.multi_select?.map((o: any) => o.name).join(', ') || '(vazio)';
    if (val.type === 'formula') sample = JSON.stringify(val.formula).substring(0, 200);
    if (val.type === 'created_time') sample = val.created_time || '(vazio)';
    if (val.type === 'last_edited_time') sample = val.last_edited_time || '(vazio)';
    console.log(`  [${val.type.padEnd(16)}] "${key}" = ${sample}`);
  });
}

inspect().catch(console.error);
