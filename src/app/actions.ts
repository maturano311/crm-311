'use server';

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function updateClienteStatus(id: number, newStatus: string) {
  try {
    await pool.query('UPDATE clientes SET status = $1 WHERE id = $2', [newStatus, id]);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    return { success: false, error: 'Falha ao atualizar status' };
  }
}

export async function marcarVisita(id: number) {
  try {
    await pool.query(
      `UPDATE clientes 
       SET data_visitacao = CURRENT_DATE, 
           tipo_entrada = $1,
           status = 'Em Andamento'
       WHERE id = $2`,
      ['JA PROSPECTADO', id]
    );
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Erro ao marcar visita:', error);
    return { success: false, error: 'Falha ao marcar visita' };
  }
}

export async function salvarEdicaoCliente(id: number, dados: {
  nome_fantasia?: string | null;
  prazo_pagamento: string | null;
  observacao_atendimento: string | null;
  telefone: string | null;
  nome_contato: string | null;
  revisitar: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  email_xml: string | null;
  email_financeiro: string | null;
  rede: string | null;
  sub_rede: string | null;
  prioridade: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  status: string | null;
}) {
  try {
    await pool.query(`
      UPDATE clientes
      SET
        nome_fantasia = COALESCE(NULLIF($1, ''), nome_fantasia),
        prazo_pagamento = $2,
        observacao_atendimento = $3,
        telefone = $4,
        nome_contato = $5,
        revisitar = $6,
        cnpj = $7,
        inscricao_estadual = $8,
        email_xml = $9,
        email_financeiro = $10,
        rede = $11,
        sub_rede = $12,
        prioridade = $13,
        endereco = $14,
        bairro = $15,
        cidade = $16,
        status = COALESCE(NULLIF($17, ''), status)
      WHERE id = $18
    `, [
      dados.nome_fantasia || null,
      dados.prazo_pagamento || null,
      dados.observacao_atendimento || null,
      dados.telefone || null,
      dados.nome_contato || null,
      dados.revisitar || null,
      dados.cnpj || null,
      dados.inscricao_estadual || null,
      dados.email_xml || null,
      dados.email_financeiro || null,
      dados.rede || null,
      dados.sub_rede || null,
      dados.prioridade || null,
      dados.endereco || null,
      dados.bairro || null,
      dados.cidade || null,
      dados.status || null,
      id
    ]);
    
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar edição:', error);
    return { success: false, error: 'Falha ao salvar edições' };
  }
}

export async function appendNotaAtendimento(id: number, notaFinal: string) {
  try {
    await pool.query(
      'UPDATE clientes SET observacao_atendimento = $1 WHERE id = $2',
      [notaFinal, id]
    );
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar nota:', error);
    return { success: false, error: 'Falha ao salvar nota' };
  }
}

export async function agendarRevisita(id: number, data: string) {
  try {
    await pool.query(
      'UPDATE clientes SET revisitar = $1 WHERE id = $2',
      [data || null, id]
    );
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Erro ao agendar revisita:', error);
    return { success: false, error: 'Falha ao agendar' };
  }
}

export async function marcarComoClienteBase(id: number) {
  try {
    await pool.query(
      "UPDATE clientes SET status = 'Cliente', tipo_entrada = 'CLIENTE_BASE' WHERE id = $1",
      [id]
    );
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Erro ao marcar como cliente base:', error);
    return { success: false, error: 'Falha ao atualizar' };
  }
}

