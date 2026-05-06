import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      nome_cliente,
      codigo_erp,
      numero_pedido,
      tipo,
      valor,
      prazo,
      data_pedido,
      status,
      mes,
      semana,
      observacoes
    } = body;

    // Validação básica do corpo
    if (!numero_pedido || !nome_cliente) {
      return NextResponse.json(
        { erro: 'Campos obrigatórios ausentes: numero_pedido e/ou nome_cliente' },
        { status: 400 }
      );
    }

    // 1. Verificação de Duplicidade (Regra de Negócio)
    const duplicateCheck = await pool.query(
      'SELECT id FROM compras WHERE numero_pedido = $1',
      [String(numero_pedido)]
    );

    if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
      // O sistema apenas ignora silenciosamente pedidos duplicados e retorna sucesso
      // para não quebrar a fila de webhooks do n8n / OpenClaw.
      return NextResponse.json(
        { mensagem: 'Pedido já existe na base de dados. Ignorado por segurança.' },
        { status: 200 }
      );
    }

    // 2. Inserção no PostgreSQL
    const insertQuery = `
      INSERT INTO compras (
        nome_cliente, codigo_erp, numero_pedido, tipo, valor, prazo, data_pedido, status, mes, semana, observacoes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING id;
    `;

    const values = [
      nome_cliente,
      codigo_erp ? String(codigo_erp) : null,
      String(numero_pedido),
      tipo || null,
      valor ? parseFloat(valor) : null,
      prazo || null,
      data_pedido ? new Date(data_pedido) : null,
      status || null,
      mes || null,
      semana || null,
      observacoes || null
    ];

    const result = await pool.query(insertQuery, values);

    return NextResponse.json(
      { 
        mensagem: 'Pedido de compra registrado com sucesso!',
        id: result.rows[0].id 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('❌ Erro no webhook /api/compras/registrar:', error);
    return NextResponse.json(
      { erro: 'Erro interno ao registrar a compra' },
      { status: 500 }
    );
  }
}
