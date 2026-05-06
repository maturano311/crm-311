import { Client } from '@notionhq/client';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const notionToken = process.env.NOTION_TOKEN;
const notion = new Client({ auth: notionToken });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function queryNotionDatabase(databaseId: string, startCursor?: string) {
  // Use the search API to find pages in the database
  const response = await (notion.search as any)({
    query: '',
    filter: {
      value: 'page',
      property: 'object',
    },
    start_cursor: startCursor,
    page_size: 100,
  });
  
  return response;
}

async function migrateFromNotion() {
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notionToken || !databaseId) {
    console.error('❌ Erro: NOTION_TOKEN ou NOTION_DATABASE_ID ausentes no .env');
    process.exit(1);
  }

  console.log('🔄 Iniciando Importação do Notion...');
  
  let hasMore = true;
  let nextCursor: string | undefined = undefined;
  let totalImportados = 0;

  try {
    while (hasMore) {
      const response = await queryNotionDatabase(databaseId, nextCursor);
      
      // Filter pages to only those in our database
      const dbPages = (response.results as any[]).filter((page: any) => 
        page.parent?.database_id === databaseId || page.parent?.database_id === databaseId.replace(/-/g, '')
      );

      for (const page of dbPages) {
        const props = page.properties;

        // Helpers de extração
        const getTitle = (prop: any) => prop?.title?.[0]?.plain_text || '';
        const getRichText = (prop: any) => {
          const text = prop?.rich_text?.[0]?.plain_text || '';
          return text.trim() === '' ? null : text.trim();
        };
        const getSelect = (prop: any) => prop?.select?.name || null;
        const getStatus = (prop: any) => prop?.status?.name || null;
        const getUrl = (prop: any) => prop?.url || null;

        // Try to get name from NOME FANTASIA (exact column name from Notion)
        let nomeFantasia = getTitle(props['NOME FANTASIA']) || getRichText(props['NOME FANTASIA']);
        
        // Fallback to other possible names
        if (!nomeFantasia) {
          nomeFantasia = getTitle(props['Nome Fantasia']) || getRichText(props['Nome Fantasia']) ||
                        getTitle(props['Name']) || getRichText(props['Name']) ||
                        getTitle(props['Nome']) || getRichText(props['Nome']) ||
                        getTitle(props['Empresa']) || getRichText(props['Empresa']) ||
                        getTitle(props['Lead']) || getRichText(props['Lead']) ||
                        getTitle(props['Cliente']) || getRichText(props['Cliente']);
        }
        
        if (!nomeFantasia) {
          continue; // Pula registros sem nome
        }

        const cnpj = getRichText(props['CNPJ']);
        const tipo = getSelect(props['TIPO']) || getSelect(props['Tipo']);
        const endereco = getRichText(props['ENDEREÇO']) || getRichText(props['Endereço']);
        const bairro = getRichText(props['BAIRRO']) || getRichText(props['Bairro']);
        const cidade = getRichText(props['CIDADE']) || getRichText(props['Cidade']);
        
        let status = getStatus(props['Status']) || getSelect(props['Status']);
        if (!status) status = 'Não iniciada';

        let prioridade = getSelect(props['PRIORIDADE']) || getSelect(props['Prioridade']) || 'MEDIA';
        let tipoEntrada = getSelect(props['TIPO DE ENTRADA']) || getSelect(props['Tipo de Entrada']) || 
                         getStatus(props['Fase de Entrada']) || 'A PROSPECTAR';
        
        const googleMapsUrl = getUrl(props['Google Maps']) || getUrl(props['URL']);

        try {
          await pool.query(`
            INSERT INTO clientes (
              nome_fantasia, cnpj, tipo, endereco, bairro, cidade, 
              status, prioridade, tipo_entrada, google_maps_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (cnpj) DO NOTHING;
          `, [
            nomeFantasia, cnpj, tipo, endereco, bairro, cidade,
            status, prioridade, tipoEntrada, googleMapsUrl
          ]);

          totalImportados++;
          console.log(`✅ [${totalImportados}] Importado: ${nomeFantasia}`);
        } catch (rowError: any) {
          console.error(`⚠️ Erro ao importar '${nomeFantasia}':`, rowError.message);
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor ?? undefined;
    }

    console.log(`\n🎉 Migração completa! Foram importados ${totalImportados} clientes!`);

  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await pool.end();
  }
}

migrateFromNotion().catch(console.error);

async function migrateFromNotion() {
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notionToken || !databaseId) {
    console.error('❌ Erro: NOTION_TOKEN ou NOTION_DATABASE_ID ausentes no .env');
    process.exit(1);
  }

  console.log('🔄 Iniciando Importação Rica do Notion...');
  
  let hasMore = true;
  let nextCursor: string | undefined = undefined;
  let totalImportados = 0;

  try {
    while (hasMore) {
      const response = await queryNotionDatabase(databaseId, nextCursor);
      
      // Filter pages to only those in our database
      const dbPages = (response.results as any[]).filter((page: any) => 
        page.parent?.database_id === databaseId || page.parent?.database_id === databaseId.replace(/-/g, '')
      );

      for (const page of dbPages) {
        const props = page.properties;

        // Helpers de extração
        const getTitle = (prop: any) => prop?.title?.[0]?.plain_text || '';
        const getRichText = (prop: any) => {
          const text = prop?.rich_text?.[0]?.plain_text || '';
          return text.trim() === '' ? null : text.trim();
        };
        const getSelect = (prop: any) => prop?.select?.name || null;
        const getStatus = (prop: any) => prop?.status?.name || null;
        const getUrl = (prop: any) => prop?.url || null;

        // Try to get name from NOME FANTASIA (exact column name from Notion)
        let nomeFantasia = getTitle(props['NOME FANTASIA']) || getRichText(props['NOME FANTASIA']);
        
        // Fallback to other possible names
        if (!nomeFantasia) {
          nomeFantasia = getTitle(props['Nome Fantasia']) || getRichText(props['Nome Fantasia']) ||
                        getTitle(props['Name']) || getRichText(props['Name']) ||
                        getTitle(props['Nome']) || getRichText(props['Nome']) ||
                        getTitle(props['Empresa']) || getRichText(props['Empresa']) ||
                        getTitle(props['Lead']) || getRichText(props['Lead']) ||
                        getTitle(props['Cliente']) || getRichText(props['Cliente']);
        }
        
        if (!nomeFantasia) {
          continue; // Pula registros sem nome
        }

        const cnpj = getRichText(props['CNPJ']);
        const tipo = getSelect(props['TIPO']) || getSelect(props['Tipo']);
        const endereco = getRichText(props['ENDEREÇO']) || getRichText(props['Endereço']);
        const bairro = getRichText(props['BAIRRO']) || getRichText(props['Bairro']);
        const cidade = getRichText(props['CIDADE']) || getRichText(props['Cidade']);
        
        let status = getStatus(props['Status']) || getSelect(props['Status']);
        if (!status) status = 'Não iniciada';

        let prioridade = getSelect(props['PRIORIDADE']) || getSelect(props['Prioridade']) || 'MEDIA';
        let tipoEntrada = getSelect(props['TIPO DE ENTRADA']) || getSelect(props['Tipo de Entrada']) || 
                         getStatus(props['Fase de Entrada']) || 'A PROSPECTAR';
        
        const googleMapsUrl = getUrl(props['Google Maps']) || getUrl(props['URL']);

        try {
          await pool.query(`
            INSERT INTO clientes (
              nome_fantasia, cnpj, tipo, endereco, bairro, cidade, 
              status, prioridade, tipo_entrada, google_maps_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (cnpj) DO NOTHING;
          `, [
            nomeFantasia, cnpj, tipo, endereco, bairro, cidade,
            status, prioridade, tipoEntrada, googleMapsUrl
          ]);

          totalImportados++;
          console.log(`✅ [${totalImportados}] Importado: ${nomeFantasia}`);
        } catch (rowError: any) {
          console.error(`⚠️ Erro ao importar '${nomeFantasia}':`, rowError.message);
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor ?? undefined;
    }

    console.log(`\n🎉 Migração completa! Foram importados ${totalImportados} clientes!`);

  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await pool.end();
  }
}

migrateFromNotion().catch(console.error);
