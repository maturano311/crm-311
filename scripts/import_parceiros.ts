import { Client } from '@notionhq/client';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

async function importarParceiros() {
  console.log('📡 Buscando parceiros do Notion...\n');
  const pages = await queryAll();
  console.log(`📋 ${pages.length} parceiros encontrados.\n`);

  if (pages.length === 0) {
    console.log('Nenhum parceiro encontrado. Verifique o ID do database.');
    await pool.end();
    return;
  }

  // Helpers
  const getTitle = (prop: any) => prop?.title?.[0]?.plain_text?.trim() || '';
  const getRichText = (prop: any) => {
    const t = prop?.rich_text?.[0]?.plain_text || '';
    return t.trim() || null;
  };
  const getSelect = (prop: any) => prop?.select?.name || null;
  const getStatus = (prop: any) => prop?.status?.name || null;
  const getNumber = (prop: any) => prop?.number ?? null;
  const getPhone = (prop: any) => prop?.phone_number || getRichText(prop);

  let ok = 0, skip = 0, erros = 0;

  for (const page of pages) {
    const p = page.properties;

    const nomeFantasia = getTitle(p['Nome Parceiro']);
    if (!nomeFantasia) { skip++; continue; }

    const razaoSocial     = getRichText(p['Razão social']);
    const cnpj            = getRichText(p['CNPJ / CPF']);
    const inscricaoEst    = getRichText(p['Insc. Estadual / Identidade']);
    const telefone        = getPhone(p['Telefone']);
    const endereco        = getRichText(p['Nome (Endereço)']);
    const numero          = getRichText(p['Número']);
    const bairro          = getRichText(p['Nome (Bairro)']);
    const cidade          = getSelect(p['Nome + UF (Cidade)']);
    const cep             = String(getNumber(p['CEP']) || getRichText(p['CEP']) || '');
    const latRaw          = getNumber(p['Latitude']);
    const lngRaw          = getNumber(p['Longitude']);
    const lat             = (latRaw !== null && latRaw >= -90 && latRaw <= 90) ? latRaw : null;
    const lng             = (lngRaw !== null && lngRaw >= -180 && lngRaw <= 180) ? lngRaw : null;
    const codParceiro     = getNumber(p['Cód. Parceiro']);
    const regiao          = getSelect(p['Região']);
    const perfil          = getRichText(p['Descrição (Perfil)']);
    const tabelaPreco     = getSelect(p['Nome (Cadastro de Tabela de Preço)']);
    const recebeSabado    = getSelect(p['Recebe no Sabado']);
    const obsLoja         = getRichText(p['Observações Loja']);
    const obsComercial    = getRichText(p['Observações comerciais']);
    const sequencia       = getNumber(p['Sequencia']);
    const statusNotion    = getStatus(p['Status']);
    const ativo           = getSelect(p['Ativo']) === 'Sim';

    try {
      await pool.query(`
        INSERT INTO parceiros (
          nome_fantasia, razao_social, cnpj, inscricao_estadual, telefone,
          endereco, numero, bairro, cidade, cep,
          lat, lng, cod_parceiro, regiao, perfil,
          tabela_preco, recebe_sabado, obs_loja, obs_comercial, sequencia, ativo
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21
        )
        ON CONFLICT (cnpj) DO UPDATE SET
          nome_fantasia = EXCLUDED.nome_fantasia,
          razao_social = EXCLUDED.razao_social,
          telefone = EXCLUDED.telefone,
          endereco = EXCLUDED.endereco,
          numero = EXCLUDED.numero,
          bairro = EXCLUDED.bairro,
          cidade = EXCLUDED.cidade,
          perfil = EXCLUDED.perfil,
          obs_comercial = EXCLUDED.obs_comercial,
          ativo = EXCLUDED.ativo
      `, [
        nomeFantasia, razaoSocial, cnpj, inscricaoEst, telefone,
        endereco, numero, bairro, cidade, cep,
        lat, lng, codParceiro, regiao, perfil,
        tabelaPreco, recebeSabado, obsLoja, obsComercial, sequencia, ativo
      ]);
      ok++;
      console.log(`  ✅ [${ok}] ${nomeFantasia} | Região: ${regiao || '?'} | Perfil: ${perfil || '?'}`);
    } catch (e: any) {
      erros++;
      console.error(`  ❌ ${nomeFantasia}: ${e.message}`);
    }
  }

  const total = await pool.query('SELECT COUNT(*) as total FROM parceiros');
  console.log(`\n🎉 Importação de Parceiros concluída!`);
  console.log(`   ✅ Importados: ${ok}`);
  console.log(`   ⏭️  Pulados (sem nome): ${skip}`);
  console.log(`   ❌ Erros: ${erros}`);
  console.log(`   🗃️  Total no banco: ${total.rows[0].total}`);
  await pool.end();
}

importarParceiros().catch(e => { console.error('❌ Erro:', e); process.exit(1); });
