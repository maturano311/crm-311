import { Client } from '@notionhq/client';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const notionToken = process.env.NOTION_TOKEN;
const notion = new Client({ auth: notionToken });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const relationCache = new Map<string, string>();

async function getRelationName(relationId: string) {
  if (relationCache.has(relationId)) return relationCache.get(relationId);
  try {
    const page = await notion.pages.retrieve({ page_id: relationId });
    const props: any = (page as any).properties;
    const titleProp = Object.values(props).find((p: any) => p.type === 'title') as any;
    const title = titleProp?.title?.[0]?.plain_text || null;
    if (title) { relationCache.set(relationId, title); return title; }
    return null;
  } catch { return null; }
}

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

async function reimportar() {
  const databaseId = process.env.NOTION_DATABASE_ID!;

  // PASSO 1: Mostra o que vai ser deletado
  const countRes = await pool.query('SELECT COUNT(*) as total FROM clientes');
  console.log(`\n⚠️  ${countRes.rows[0].total} leads serão deletados e reimportados do Notion.`);
  console.log('🔄 Aguarde...\n');

  // PASSO 2: Deletar TODOS os leads
  await pool.query('DELETE FROM clientes');
  console.log('🗑️  Tabela clientes limpa.\n');

  // PASSO 3: Buscar todas as páginas do Notion
  console.log('📡 Buscando leads do Notion...');
  const pages = await queryAll(databaseId);
  console.log(`📋 ${pages.length} leads encontrados no Notion.\n`);

  const getTitle = (prop: any) => prop?.title?.[0]?.plain_text?.trim() || '';
  const getRichText = (prop: any) => { const t = prop?.rich_text?.[0]?.plain_text || ''; return t.trim() || null; };
  const getSelect = (prop: any) => prop?.select?.name || null;
  const getStatus = (prop: any) => prop?.status?.name || null;
  const getUrl = (prop: any) => prop?.url || null;
  const getPhone = (prop: any) => prop?.phone_number || getRichText(prop);
  const getEmail = (prop: any) => prop?.email || getRichText(prop);
  // REDE é rollup(array) de relations — precisa resolver o ID da relation
  const getRollupRelation = async (prop: any): Promise<string | null> => {
    const array = prop?.rollup?.array;
    if (!array || array.length === 0) return null;
    const firstItem = array[0];
    if (firstItem?.type === 'relation' && firstItem.relation?.length > 0) {
      return await getRelationName(firstItem.relation[0].id);
    }
    // fallback para select ou title direto no array
    return firstItem?.select?.name || firstItem?.title?.[0]?.plain_text || null;
  };
  const getDate = (prop: any) => prop?.date?.start || null;
  const resolveRelation = async (prop: any) => {
    if (prop?.relation?.length > 0) return await getRelationName(prop.relation[0].id);
    return getSelect(prop) || getRichText(prop);
  };

  let ok = 0, skip = 0, erros = 0;

  for (const page of pages) {
    const props = page.properties;
    const nomeFantasia = getTitle(props['NOME FANTASIA']);
    if (!nomeFantasia) { skip++; continue; }

    const cnpj              = getRichText(props['CNPJ']);
    const inscricao_estadual = getRichText(props['INSCRIÇÃO ESTADUAL']);
    const tipo              = getSelect(props['TIPO']);
    const status            = getStatus(props['Status']);
    const endereco          = getRichText(props['ENDEREÇO']);
    const cidade            = getSelect(props['CIDADE']);
    const bairro            = getRichText(props['BAIRRO']);
    const email_xml         = getEmail(props['E-mail XML']);
    const email_financeiro  = getEmail(props['E-mail FINANCEIRO']);
    const telefone          = getPhone(props['Telefone']);
    const rede              = await getRollupRelation(props['REDE']);    // rollup(array) de relation
    const sub_rede          = await resolveRelation(props['SUB REDE']);
    const prazo_pagamento   = await resolveRelation(props['PRAZO DE PAGAMENTO']);
    const tipo_entrada      = getStatus(props['TIPO DE ENTRADA']);      // status no Notion
    const observacao_rota   = getRichText(props['OBSERVAÇÃO']);
    const revisitar         = getDate(props['REVISITAR']);
    const nome_contato      = getRichText(props['Nome do Contato']);
    const prioridade        = getStatus(props['PRIORIDADE']);           // status no Notion
    const google_place_id   = getRichText(props['Google Place ID']);
    const observacao_atendimento = getRichText(props['Texto']);
    const google_maps_url   = getUrl(props['Google Maps']);
    const enviado_erp       = getSelect(props['Enviado ERP']) === 'SIM'; // select no Notion

    try {
      await pool.query(`
        INSERT INTO clientes (
          nome_fantasia, cnpj, inscricao_estadual, tipo, status, endereco, cidade, bairro,
          email_xml, email_financeiro, telefone, rede, sub_rede, prazo_pagamento,
          tipo_entrada, observacao_rota, revisitar, nome_contato, prioridade,
          google_place_id, observacao_atendimento, google_maps_url, enviado_erp
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14,
          $15,$16,$17,$18,$19,
          $20,$21,$22,$23
        )
      `, [
        nomeFantasia, cnpj, inscricao_estadual, tipo, status, endereco, cidade, bairro,
        email_xml, email_financeiro, telefone, rede, sub_rede, prazo_pagamento,
        tipo_entrada, observacao_rota, revisitar, nome_contato, prioridade,
        google_place_id, observacao_atendimento, google_maps_url, enviado_erp
      ]);
      ok++;
      console.log(`  ✅ [${ok}] ${nomeFantasia} | ${tipo_entrada || '?'} | Prior: ${prioridade || 'null'} | Rede: ${rede || '?'}`);
    } catch (e: any) {
      erros++;
      console.error(`  ❌ Erro: ${nomeFantasia} — ${e.message}`);
    }
  }

  const final = await pool.query('SELECT COUNT(*) as total FROM clientes');
  console.log(`\n🎉 Reimportação concluída!`);
  console.log(`   ✅ Importados: ${ok}`);
  console.log(`   ⏭️  Pulados (sem nome): ${skip}`);
  console.log(`   ❌ Erros: ${erros}`);
  console.log(`   🗃️  Total no banco: ${final.rows[0].total}`);
  await pool.end();
}

reimportar().catch(console.error);
