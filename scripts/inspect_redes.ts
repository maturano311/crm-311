import { Client } from '@notionhq/client';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DATABASE_ID = '2a1becc369cf80429280de5fa1725e55';

async function inspect() {
  const res = await notion.databases.query({ database_id: DATABASE_ID, page_size: 5 });
  console.log('Total de registros:', res.results.length);
  
  if (res.results.length > 0) {
    const page = res.results[0] as any;
    console.log('\nPropriedades:');
    Object.entries(page.properties).forEach(([key, val]: any) => {
      let value = '';
      if (val.type === 'title') value = val.title?.[0]?.plain_text || '';
      if (val.type === 'rich_text') value = val.rich_text?.[0]?.plain_text || '';
      if (val.type === 'relation') value = `[${val.relation?.length} relations]`;
      if (val.type === 'select') value = val.select?.name || '';
      if (val.type === 'multi_select') value = val.multi_select?.map((s: any) => s.name).join(', ') || '';
      console.log(`  [${val.type}] ${key}: "${value}"`);
    });
  }
  await pool.end();
}
inspect().catch(console.error);
