import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { nome, telefone, estabelecimento, cidade, segmento, cnpj } = body;

    if (!nome) {
      return NextResponse.json(
        { erro: 'Campo obrigatório ausente: nome' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO clientes (
        nome_fantasia, telefone, tipo, cidade, segmento, cnpj,
        status, tipo_entrada
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Não iniciada', 'WEBHOOK')
      RETURNING id`,
      [
        nome,
        telefone || null,
        estabelecimento || null,
        cidade || null,
        segmento || null,
        cnpj || null,
      ]
    );

    return NextResponse.json(
      { mensagem: 'Lead registrado com sucesso!', id: result.rows[0].id },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Erro no webhook /api/leads:', error);
    return NextResponse.json(
      { erro: 'Erro interno ao registrar o lead' },
      { status: 500 }
    );
  }
}
