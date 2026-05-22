'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BarChart3, ShoppingCart, XCircle, DollarSign,
  TrendingUp, Percent, Clock, AlertTriangle, Trophy, ShoppingBag,
} from 'lucide-react';
import {
  buscarRelatoriosVendas,
  type Resumo,
  type ClienteSemVisita,
  type ClienteSemCompra,
  type RankingItem,
} from '../actions/relatorios';

// ── Tipos e constantes ───────────────────────────────────────────────────────

type Periodo = '7d' | '30d' | 'mes' | 'tudo';

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: '7d',   label: '7 dias'    },
  { key: '30d',  label: '30 dias'   },
  { key: 'mes',  label: 'Este mês'  },
  { key: 'tudo', label: 'Tudo'      },
];

// ── Formatadores ─────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function parseDateParts(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function RelatoriosClient({
  initialResumo,
  initialSemVisita,
  initialSemCompra,
  initialRanking,
}: {
  initialResumo:    Resumo | null;
  initialSemVisita: ClienteSemVisita[];
  initialSemCompra: ClienteSemCompra[];
  initialRanking:   RankingItem[];
}) {
  const [periodo,    setPeriodo]    = useState<Periodo>('30d');
  const [resumo,     setResumo]     = useState<Resumo | null>(initialResumo);
  const [ranking,    setRanking]    = useState<RankingItem[]>(initialRanking);
  const [isPending,  startTransition] = useTransition();

  // semVisita e semCompra não mudam com o período — usam dados iniciais diretamente
  const semVisita = initialSemVisita;
  const semCompra = initialSemCompra;

  const handlePeriodo = (p: Periodo) => {
    if (p === periodo || isPending) return;
    setPeriodo(p);
    startTransition(async () => {
      const data = await buscarRelatoriosVendas(p);
      if (data.success) {
        setResumo(data.resumo);
        setRanking(data.ranking);
      }
    });
  };

  const r = resumo;
  const criticos = semVisita.filter(c => c.dias_sem_visita === null || c.dias_sem_visita >= 30);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 bg-[var(--card)] border border-[var(--border)] rounded-full hover:bg-[var(--secondary)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--primary)]" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[var(--primary)]" />
                Relatórios de Vendas
              </h1>
              <p className="text-xs text-[var(--muted-foreground)]">
                Performance e carteira de parceiros
              </p>
            </div>
          </div>

          {/* Filtro de período */}
          <div className="flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full p-1">
            {PERIODOS.map(p => (
              <button
                key={p.key}
                onClick={() => handlePeriodo(p.key)}
                disabled={isPending}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all disabled:cursor-wait ${
                  periodo === p.key
                    ? 'bg-[var(--primary)] text-black'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ── Conteúdo ───────────────────────────────────────────────────── */}
      <div
        className={`max-w-6xl mx-auto px-4 py-6 space-y-8 transition-opacity duration-200 ${
          isPending ? 'opacity-40 pointer-events-none' : 'opacity-100'
        }`}
      >

        {/* ═══ Bloco 1: Resumo do período ════════════════════════════════ */}
        <section>
          <h2 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
            Resumo do período
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard
              icon={<BarChart3 className="w-5 h-5" />}
              label="Visitas"
              value={r?.total_visitas ?? 0}
              sub="total de visitas"
              color="text-[var(--primary)]"
              format="number"
            />
            <KpiCard
              icon={<ShoppingCart className="w-5 h-5" />}
              label="Pedidos"
              value={r?.compraram ?? 0}
              sub="visitas com pedido"
              color="text-emerald-400"
              format="number"
            />
            <KpiCard
              icon={<XCircle className="w-5 h-5" />}
              label="Sem pedido"
              value={r?.nao_compraram ?? 0}
              sub="visitas sem pedido"
              color="text-rose-400"
              format="number"
            />
            <KpiCard
              icon={<DollarSign className="w-5 h-5" />}
              label="Faturamento"
              value={r?.faturamento_total ?? 0}
              sub="receita total"
              color="text-emerald-400"
              format="currency"
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Ticket médio"
              value={r?.ticket_medio ?? 0}
              sub="por pedido"
              color="text-amber-400"
              format="currency"
            />
            <KpiCard
              icon={<Percent className="w-5 h-5" />}
              label="Conversão"
              value={r?.taxa_conversao ?? 0}
              sub="das visitas compraram"
              color="text-[var(--primary)]"
              format="percent"
            />
          </div>
        </section>

        {/* ═══ Bloco 2: Clientes sem visita 14+ dias ═════════════════════ */}
        <section>
          <div className="glass-panel rounded-2xl overflow-hidden">

            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--primary)]" />
                Clientes sem visita há 14+ dias
                <span className="text-[var(--primary)] normal-case font-normal">
                  ({semVisita.length})
                </span>
              </h2>
              {criticos.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {criticos.length} crítico{criticos.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {semVisita.length === 0 ? (
              <div className="text-center py-14 text-[var(--muted-foreground)]">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Todos os parceiros foram visitados recentemente.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--secondary)]/30 text-[var(--muted-foreground)]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Parceiro</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Bairro</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Última visita</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Dias sem visita</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {semVisita.map((c, idx) => {
                        const critico = c.dias_sem_visita === null || c.dias_sem_visita >= 30;
                        return (
                          <tr
                            key={c.id}
                            className={`transition-colors ${
                              critico
                                ? 'bg-rose-500/5 hover:bg-rose-500/10'
                                : idx % 2 === 0
                                  ? 'hover:bg-[var(--secondary)]/20'
                                  : 'bg-[var(--card)]/30 hover:bg-[var(--secondary)]/20'
                            }`}
                          >
                            <td className="px-4 py-3 font-bold">
                              <span className="flex items-center gap-2">
                                {critico && (
                                  <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                                )}
                                {c.nome_fantasia}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[var(--muted-foreground)]">
                              {c.bairro || '—'}
                            </td>
                            <td className="px-4 py-3 text-[var(--muted-foreground)]">
                              {c.ultima_visita
                                ? parseDateParts(c.ultima_visita).toLocaleDateString('pt-BR')
                                : <span className="font-bold text-rose-400">Nunca visitado</span>
                              }
                            </td>
                            <td className="px-4 py-3">
                              <DiasBadge dias={c.dias_sem_visita} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 py-3 border-t border-[var(--border)] flex flex-wrap gap-4 text-xs text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Crítico — 30+ dias ou nunca visitado
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Atenção — 14 a 29 dias
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ═══ Bloco 3: Visitados sem compra ════════════════════════════ */}
        <section>
          <div className="glass-panel rounded-2xl overflow-hidden">

            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[var(--primary)]" />
                Clientes sem compra há 14+ dias
                <span className="text-[var(--primary)] normal-case font-normal">
                  ({semCompra.length})
                </span>
              </h2>
              {semCompra.filter(c => c.dias_sem_compra === null || c.dias_sem_compra >= 30).length > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {semCompra.filter(c => c.dias_sem_compra === null || c.dias_sem_compra >= 30).length} crítico{semCompra.filter(c => c.dias_sem_compra === null || c.dias_sem_compra >= 30).length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {semCompra.length === 0 ? (
              <div className="text-center py-14 text-[var(--muted-foreground)]">
                <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Todos os parceiros visitados compraram recentemente.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--secondary)]/30 text-[var(--muted-foreground)]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Parceiro</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Bairro</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Última compra</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Dias sem compra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {semCompra.map((c, idx) => {
                        const critico = c.dias_sem_compra === null || c.dias_sem_compra >= 30;
                        return (
                          <tr
                            key={c.id}
                            className={`transition-colors ${
                              critico
                                ? 'bg-rose-500/5 hover:bg-rose-500/10'
                                : idx % 2 === 0
                                  ? 'hover:bg-[var(--secondary)]/20'
                                  : 'bg-[var(--card)]/30 hover:bg-[var(--secondary)]/20'
                            }`}
                          >
                            <td className="px-4 py-3 font-bold">
                              <span className="flex items-center gap-2">
                                {critico && (
                                  <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                                )}
                                {c.nome_fantasia}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[var(--muted-foreground)]">{c.bairro || '—'}</td>
                            <td className="px-4 py-3 text-[var(--muted-foreground)]">
                              {c.ultima_compra
                                ? parseDateParts(c.ultima_compra).toLocaleDateString('pt-BR')
                                : <span className="font-bold text-rose-400">Nunca comprou</span>
                              }
                            </td>
                            <td className="px-4 py-3">
                              <DiasBadge dias={c.dias_sem_compra} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 py-3 border-t border-[var(--border)] flex flex-wrap gap-4 text-xs text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Crítico — 30+ dias ou nunca comprou
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Atenção — 14 a 29 dias
                  </span>
                </div>
              </>
            )}

          </div>
        </section>

        {/* ═══ Bloco 4: Ranking top 15 ═══════════════════════════════════ */}
        <section>
          <div className="glass-panel rounded-2xl overflow-hidden">

            <div className="px-5 py-4 border-b border-[var(--border)]">
              <h2 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[var(--primary)]" />
                Ranking por faturamento — Top 15
                <span className="text-[var(--primary)] normal-case font-normal">no período</span>
              </h2>
            </div>

            {ranking.length === 0 ? (
              <div className="text-center py-14 text-[var(--muted-foreground)]">
                <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nenhuma venda registrada no período.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--secondary)]/30 text-[var(--muted-foreground)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider w-12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Parceiro</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Bairro</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Visitas</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Pedidos</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Faturamento</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Ticket médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {ranking.map((item, idx) => (
                      <tr
                        key={`${item.nome_fantasia}-${item.posicao}`}
                        className={`transition-colors hover:bg-[var(--secondary)]/20 ${
                          idx % 2 === 0 ? '' : 'bg-[var(--card)]/30'
                        }`}
                      >
                        <td className="px-4 py-3 text-center">
                          <MedalIcon pos={item.posicao} />
                        </td>
                        <td className="px-4 py-3 font-bold">{item.nome_fantasia}</td>
                        <td className="px-4 py-3 text-[var(--muted-foreground)]">
                          {item.bairro || '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-[var(--muted-foreground)]">
                          {item.total_visitas}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-emerald-400">{item.total_compras}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-[var(--primary)]">
                            {fmtBRL(item.faturamento_total)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[var(--muted-foreground)]">
                          {fmtBRL(item.ticket_medio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </section>

      </div>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, color, format, className = '',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  color: string;
  format: 'number' | 'currency' | 'percent';
  className?: string;
}) {
  let display: string;
  if (format === 'currency') {
    display = fmtBRL(value);
  } else if (format === 'percent') {
    display = `${value.toFixed(1)}%`;
  } else {
    display = String(value);
  }

  return (
    <div className={`glass-panel rounded-2xl p-4 space-y-1 ${className}`}>
      <div className={`flex items-center gap-2 ${color}`}>
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
          {label}
        </span>
      </div>
      <p className={`font-bold leading-tight ${format === 'currency' ? 'text-lg' : 'text-3xl'}`}>
        {display}
      </p>
      <p className="text-xs text-[var(--muted-foreground)]">{sub}</p>
    </div>
  );
}

function DiasBadge({ dias }: { dias: number | null }) {
  if (dias === null) {
    return <span className="font-bold text-rose-400">—</span>;
  }
  const cor = dias >= 30 ? 'text-rose-400' : 'text-amber-400';
  return <span className={`font-bold ${cor}`}>{dias}d</span>;
}

function MedalIcon({ pos }: { pos: number }) {
  if (pos === 1) return <span className="text-base">🥇</span>;
  if (pos === 2) return <span className="text-base">🥈</span>;
  if (pos === 3) return <span className="text-base">🥉</span>;
  return (
    <span className="text-xs font-bold text-[var(--muted-foreground)]">{pos}º</span>
  );
}
