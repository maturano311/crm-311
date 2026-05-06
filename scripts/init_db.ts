import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function initDB() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Erro: A variável DATABASE_URL não foi encontrada no arquivo .env');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    console.log('🔄 Conectando ao banco de dados...');
    await client.connect();

    console.log('🏗️ Criando tabela "clientes"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nome_fantasia VARCHAR(255) NOT NULL,
        cnpj VARCHAR(20) UNIQUE,
        tipo VARCHAR(50),
        endereco TEXT,
        bairro VARCHAR(100),
        cidade VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Não iniciada',
        prioridade VARCHAR(20) DEFAULT 'MEDIA',
        tipo_entrada VARCHAR(50) DEFAULT 'A PROSPECTAR',
        google_maps_url TEXT,
        data_visitacao DATE,
        revisitar BOOLEAN DEFAULT FALSE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('🏗️ Criando tabela "compras"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS compras (
        id SERIAL PRIMARY KEY,
        nome_cliente VARCHAR(255) NOT NULL,
        codigo_erp VARCHAR(50),
        numero_pedido VARCHAR(50) UNIQUE NOT NULL, -- Regra de negócio: Previne duplicidade
        tipo VARCHAR(50),
        valor DECIMAL(10, 2),
        prazo VARCHAR(50),
        data_pedido DATE,
        status VARCHAR(50),
        mes VARCHAR(20),
        semana VARCHAR(20),
        observacoes TEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Banco de dados inicializado com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao inicializar tabelas:', err);
  } finally {
    await client.end();
  }
}

initDB();
