import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupParceiros() {
  console.log('🔄 Criando tabelas do módulo Parceiros...\n');

  // 1. Tabela parceiros
  await pool.query(`
    CREATE TABLE IF NOT EXISTS parceiros (
      id SERIAL PRIMARY KEY,
      nome_fantasia VARCHAR(255) NOT NULL,
      razao_social VARCHAR(255),
      cnpj VARCHAR(30) UNIQUE,
      inscricao_estadual VARCHAR(50),
      telefone VARCHAR(50),
      endereco TEXT,
      numero VARCHAR(20),
      bairro VARCHAR(100),
      cidade VARCHAR(150),
      cep VARCHAR(15),
      lat DECIMAL(10, 7),
      lng DECIMAL(10, 7),
      cod_parceiro INTEGER,
      regiao VARCHAR(20),
      perfil VARCHAR(100),
      tabela_preco VARCHAR(100),
      recebe_sabado VARCHAR(10),
      obs_loja TEXT,
      obs_comercial TEXT,
      sequencia INTEGER,
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('  ✅ Tabela parceiros criada');

  // 2. Tabela visitas_parceiro
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitas_parceiro (
      id SERIAL PRIMARY KEY,
      parceiro_id INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
      data_visita DATE NOT NULL DEFAULT CURRENT_DATE,
      tipo_visita VARCHAR(20) NOT NULL DEFAULT 'FISICO',
      comprou BOOLEAN DEFAULT false,
      valor_pedido DECIMAL(10, 2),
      observacao TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('  ✅ Tabela visitas_parceiro criada');

  // Índice para consultas rápidas por parceiro e data
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_visitas_parceiro_id ON visitas_parceiro(parceiro_id);
    CREATE INDEX IF NOT EXISTS idx_visitas_data ON visitas_parceiro(data_visita DESC);
  `);
  console.log('  ✅ Índices de visitas criados');

  // 3. Tabela campanhas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campanhas (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      data_alvo DATE NOT NULL,
      descricao TEXT,
      dias_antecedencia INTEGER DEFAULT 7,
      ativa BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('  ✅ Tabela campanhas criada');

  // 4. Tabela campanha_parceiros (quem foi abordado)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campanha_parceiros (
      id SERIAL PRIMARY KEY,
      campanha_id INTEGER NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
      parceiro_id INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
      abordado BOOLEAN DEFAULT false,
      comprou BOOLEAN DEFAULT false,
      data_abordagem DATE,
      UNIQUE(campanha_id, parceiro_id)
    );
  `);
  console.log('  ✅ Tabela campanha_parceiros criada');

  // 5. Popular campanhas padrão (datas comemorativas recorrentes)
  const campanhasPadrao = [
    { nome: 'Dia das Mães 2026', data: '2026-05-10', desc: 'Ação especial para Dia das Mães — aumento de demanda de sorvetes/sobremesas', dias: 10 },
    { nome: 'Dia dos Namorados 2026', data: '2026-06-12', desc: 'Ação para Dia dos Namorados — kits especiais, sabores premium', dias: 10 },
    { nome: 'Festa Junina 2026', data: '2026-06-24', desc: 'Ação Festa Junina — sabores temáticos, combos', dias: 14 },
    { nome: 'Dia dos Pais 2026', data: '2026-08-09', desc: 'Ação para Dia dos Pais', dias: 10 },
    { nome: 'Dia das Crianças 2026', data: '2026-10-12', desc: 'Ação para Dia das Crianças — picolés, sabores infantis', dias: 10 },
    { nome: 'Black Friday 2026', data: '2026-11-27', desc: 'Ação Black Friday — descontos e combos promocionais', dias: 14 },
    { nome: 'Natal 2026', data: '2026-12-25', desc: 'Ação de Natal — sobremesas especiais, cestas, volume alto', dias: 14 },
    { nome: 'Réveillon / Ano Novo 2027', data: '2026-12-31', desc: 'Ação Réveillon — volume alto, delivery especial', dias: 10 },
    { nome: 'Carnaval 2027', data: '2027-02-14', desc: 'Ação de Carnaval — aumento de demanda em pontos turísticos e festas', dias: 14 },
  ];

  for (const c of campanhasPadrao) {
    await pool.query(`
      INSERT INTO campanhas (nome, data_alvo, descricao, dias_antecedencia)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [c.nome, c.data, c.desc, c.dias]);
  }
  console.log(`  ✅ ${campanhasPadrao.length} campanhas padrão cadastradas`);

  console.log('\n🎉 Módulo Parceiros configurado com sucesso!');
  await pool.end();
}

setupParceiros().catch(e => { console.error('❌ Erro:', e); process.exit(1); });
