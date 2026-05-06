import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function expandirBanco() {
  console.log('🔄 Adicionando trava de PRIORIDADE...');
  try {
    const checkPrioridade = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_prioridade_cliente') THEN
          ALTER TABLE clientes ADD CONSTRAINT chk_prioridade_cliente CHECK (
            prioridade IN ('ALTA', 'MEDIA', 'BAIXA') OR prioridade IS NULL
          );
        END IF;
      END $$;
    `;
    await pool.query(checkPrioridade);

    console.log('🔄 Adicionando colunas extras do Notion...');
    const addColumns = `
      ALTER TABLE clientes 
        ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(50),
        ADD COLUMN IF NOT EXISTS email_xml VARCHAR(255),
        ADD COLUMN IF NOT EXISTS email_financeiro VARCHAR(255),
        ADD COLUMN IF NOT EXISTS telefone VARCHAR(50),
        ADD COLUMN IF NOT EXISTS rede VARCHAR(100),
        ADD COLUMN IF NOT EXISTS sub_rede VARCHAR(100),
        ADD COLUMN IF NOT EXISTS prazo_pagamento VARCHAR(100),
        ADD COLUMN IF NOT EXISTS observacao_rota TEXT,
        ADD COLUMN IF NOT EXISTS nome_contato VARCHAR(255),
        ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS observacao_atendimento TEXT,
        ADD COLUMN IF NOT EXISTS enviado_erp BOOLEAN DEFAULT false;

      -- Alterar o tipo do revisitar se necessário (no init tava BOOLEAN, no notion é DATE)
      ALTER TABLE clientes ALTER COLUMN revisitar DROP DEFAULT;
      ALTER TABLE clientes ALTER COLUMN revisitar TYPE DATE USING NULL;
    `;
    await pool.query(addColumns);

    console.log('✅ Trava de PRIORIDADE aplicada com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao alterar tabela:', error);
  } finally {
    await pool.end();
  }
}

expandirBanco();
