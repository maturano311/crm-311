import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function testConnection() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Erro: A variável DATABASE_URL não foi encontrada no arquivo .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
  });

  try {
    console.log('🔄 Conectando ao banco de dados...');
    await client.connect();
    
    const res = await client.query('SELECT NOW() as time');
    console.log('✅ Conexão bem-sucedida!');
    console.log(`⏱️  Horário no servidor do BD: ${res.rows[0].time}`);
    
  } catch (err) {
    console.error('❌ Erro de conexão:', err);
  } finally {
    await client.end();
  }
}

testConnection();
