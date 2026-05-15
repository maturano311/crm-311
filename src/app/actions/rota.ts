'use server';

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function desfazerVisitaRota(id: number, dados: {
  status: string;
  tipo_entrada: string;
  revisitar: string | null;
  observacao_atendimento: string | null;
}) {
  try {
    await pool.query(`
      UPDATE clientes
      SET
        data_visitacao = NULL,
        status = $1,
        tipo_entrada = $2,
        revisitar = $3,
        observacao_atendimento = $4
      WHERE id = $5
    `, [dados.status, dados.tipo_entrada, dados.revisitar || null, dados.observacao_atendimento || null, id]);
    revalidatePath('/rota');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function buscarRotaDoDia(data: string) {
  if (!data || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(data)) {
    console.warn('buscarRotaDoDia chamado com data inválida:', data);
    return { success: false, error: 'Data inválida para buscar rota' };
  }

  try {
    const res = await pool.query(`
      SELECT id, nome_fantasia, endereco, bairro, cidade, status, prioridade, tipo_entrada, google_maps_url, telefone, nome_contato, revisitar, observacao_atendimento, observacao_rota
      FROM clientes
      WHERE revisitar::date = $1::date
      AND status NOT IN ('Descartado', 'Excluído')
      ORDER BY prioridade DESC, nome_fantasia ASC
    `, [data]);

    return { success: true, data: res.rows };
  } catch (error: any) {
    console.error('Erro ao buscar rota do dia:', error);
    return { success: false, error: error.message };
  }
}

export async function removerRevisitar(id: number) {
  try {
    await pool.query('UPDATE clientes SET revisitar = NULL WHERE id = $1', [id]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Confirma visita na tela de Rota: marca visita, muda status, salva nota e limpa revisitar
export async function confirmarVisitaRota(id: number, nota: string | null) {
  try {
    const hoje = new Date().toLocaleDateString('pt-BR');
    
    // Busca nota anterior para anexar
    const atual = await pool.query('SELECT observacao_atendimento FROM clientes WHERE id = $1', [id]);
    const notaAnterior = atual.rows[0]?.observacao_atendimento || null;
    
    let notaFinal = notaAnterior;
    if (nota && nota.trim() !== '') {
      const novaLinha = `[${hoje}] ${nota.trim()}`;
      notaFinal = notaAnterior ? `${notaAnterior}\n${novaLinha}` : novaLinha;
    }

    await pool.query(`
      UPDATE clientes
      SET 
        data_visitacao = CURRENT_DATE,
        tipo_entrada = 'JA PROSPECTADO',
        status = 'Em Andamento',
        revisitar = NULL,
        observacao_atendimento = $1
      WHERE id = $2
    `, [notaFinal, id]);

    revalidatePath('/rota');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao confirmar visita:', error);
    return { success: false, error: error.message };
  }
}
