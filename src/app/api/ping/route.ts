import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query('SELECT COUNT(*) as clientes FROM clientes');
    return NextResponse.json({ ok: true, clientes: result.rows[0].clientes, env: !!process.env.DATABASE_URL });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, code: e.code, env: !!process.env.DATABASE_URL });
  }
}
