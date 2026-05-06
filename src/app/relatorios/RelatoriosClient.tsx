'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Users, CheckCircle, AlertCircle,
  Clock, CalendarCheck, CalendarX, BarChart3, ArrowUpDown,
  ChevronUp, ChevronDown, TrendingUp
} from 'lucide-react';

type Cidade = {
  cidade: string;
  total: number;
  nao_visitado: number;
  em_andamento: number;
  clientes: number;
  alta: number;
  media: number;
  baixa: number;
  sem_agenda: number;
  com_agenda: number;
};

type Kpi = {
  total_ativos: number;
  a_prospectar: number;
  em_andamento: number;
  clientes: number;
  alta_ativa: number;
  media_ativa: number;
  baixa_ativa: number;
  sem_agendamento: number;
  com_agendamento: number;
};

type SortKey = keyof Cidade;
type SortDir = 'asc' | 'desc';

export default function RelatoriosClient({ kpi, cidades }: { kpi: Kpi; cidades: Cidade[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [busca, setBusca] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const cidadesFiltradas = cidades
    .filter(c => c.cidade.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => {
      const av = Number(a[sortKey]) || 0;
      const bv = Number(b[sortKey]) || 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  const totalAtivos = Number(kpi?.total_ativos || 0);
  const taxaConversao = totalAtivos > 0
    ? ((Number(kpi.clientes) / totalAtivos) * 100).toFixed(1)
    : '0';

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-[var(--primary)]" />
      : <ChevronUp className="w-3 h-3 text-[var(--primary)]" />;
  };

  const Th = ({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`px-3 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none hover:text-[var(--primary)] transition-colors whitespace-nowrap ${className}`}
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-1">
        {label} <SortIcon col={col} />
      </span>
    </th>
  );

  // Barra de progresso
  const Bar = ({ value, total, color }: { value: number; total: number; color: string }) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-[var(--muted-foreground)] w-6 text-right">{value}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 bg-[var(--card)] border border-[var(--border)] rounded-full hover:bg-[var(--secondary)] transition-colors">
              <ArrowLeft className="w-5 h-5 text-[var(--primary)]" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[var(--primary)]" />
                Inteligência de Campo
              </h1>
              <p className="text-xs text-[var(--muted-foreground)]">Onde ir, quem visitar, o que está parado</p>
            </div>
          </div>
          <Link
            href="/"
            className="text-xs font-bold border border-[var(--primary)] text-[var(--primary)] px-4 py-2 rounded-full hover:bg-[var(--primary)] hover:text-black transition-all"
          >
            Ver Leads
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">

        {/* KPIs Globais */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            icon={<Users className="w-5 h-5" />}
            label="Total Ativos"
            value={kpi?.total_ativos || 0}
            sub="na base"
            color="text-[var(--primary)]"
          />
          <KpiCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="A Prospectar"
            value={kpi?.a_prospectar || 0}
            sub="nunca visitados"
            color="text-slate-400"
          />
          <KpiCard
            icon={<Clock className="w-5 h-5" />}
            label="Em Andamento"
            value={kpi?.em_andamento || 0}
            sub="já visitados"
            color="text-amber-400"
          />
          <KpiCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Clientes"
            value={kpi?.clientes || 0}
            sub={`${taxaConversao}% conv.`}
            color="text-emerald-400"
          />
          <KpiCard
            icon={<CalendarX className="w-5 h-5" />}
            label="Sem Agenda"
            value={kpi?.sem_agendamento || 0}
            sub="precisam agendamento"
            color="text-rose-400"
            className="col-span-2 md:col-span-1"
          />
        </div>

        {/* Distribuição de Prioridade */}
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
            Pipeline por Prioridade (leads ativos excluindo clientes)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PrioCard
              label="ALTA"
              value={Number(kpi?.alta_ativa || 0)}
              total={totalAtivos}
              barColor="bg-rose-500"
              textColor="text-rose-400"
              badgeBg="bg-rose-500/10"
            />
            <PrioCard
              label="MÉDIA"
              value={Number(kpi?.media_ativa || 0)}
              total={totalAtivos}
              barColor="bg-amber-500"
              textColor="text-amber-400"
              badgeBg="bg-amber-500/10"
            />
            <PrioCard
              label="BAIXA"
              value={Number(kpi?.baixa_ativa || 0)}
              total={totalAtivos}
              barColor="bg-emerald-500"
              textColor="text-emerald-400"
              badgeBg="bg-emerald-500/10"
            />
          </div>
        </div>

        {/* Tabela por Cidade */}
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[var(--primary)]" />
              Breakdown por Cidade
              <span className="text-[var(--primary)] normal-case font-normal">({cidadesFiltradas.length} cidades)</span>
            </h2>
            <input
              type="text"
              placeholder="Filtrar cidade..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="bg-[var(--background)] border border-[var(--border)] rounded-full px-4 py-1.5 text-sm focus:outline-none focus:border-[var(--primary)] w-full sm:w-48"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--secondary)]/30 text-[var(--muted-foreground)]">
                <tr>
                  <Th col="cidade" label="Cidade" />
                  <Th col="total" label="Total" />
                  <Th col="nao_visitado" label="Não Visitado" />
                  <Th col="em_andamento" label="Em Andamento" />
                  <Th col="clientes" label="Clientes" />
                  <Th col="alta" label="🔴 Alta" />
                  <Th col="media" label="🟡 Média" />
                  <Th col="sem_agenda" label="Sem Agenda" />
                  <Th col="com_agenda" label="Com Agenda" />
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-left">Conv.</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {cidadesFiltradas.map((c, idx) => {
                  const conv = c.total > 0 ? Math.round((c.clientes / c.total) * 100) : 0;
                  const urgente = c.alta > 0 && c.nao_visitado > 0;
                  return (
                    <tr
                      key={c.cidade}
                      className={`hover:bg-[var(--secondary)]/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-[var(--card)]/30'}`}
                    >
                      <td className="px-3 py-3 font-bold whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {urgente && <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" title="Alta prioridade sem visita" />}
                          {c.cidade}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-bold text-[var(--foreground)]">{c.total}</td>
                      <td className="px-3 py-3">
                        <span className={`font-bold ${c.nao_visitado > 0 ? 'text-slate-300' : 'text-[var(--muted-foreground)]'}`}>
                          {c.nao_visitado}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`font-bold ${c.em_andamento > 0 ? 'text-amber-400' : 'text-[var(--muted-foreground)]'}`}>
                          {c.em_andamento}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`font-bold ${c.clientes > 0 ? 'text-emerald-400' : 'text-[var(--muted-foreground)]'}`}>
                          {c.clientes}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`font-bold ${c.alta > 0 ? 'text-rose-400' : 'text-[var(--muted-foreground)]'}`}>
                          {c.alta}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`${c.media > 0 ? 'text-amber-300' : 'text-[var(--muted-foreground)]'}`}>
                          {c.media}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`font-bold ${c.sem_agenda > 0 ? 'text-rose-300' : 'text-[var(--muted-foreground)]'}`}>
                          {c.sem_agenda}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`${c.com_agenda > 0 ? 'text-emerald-300' : 'text-[var(--muted-foreground)]'}`}>
                          {c.com_agenda}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {/* Barra de conversão */}
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${conv >= 30 ? 'bg-emerald-500' : conv >= 10 ? 'bg-amber-500' : 'bg-slate-600'}`}
                              style={{ width: `${conv}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--muted-foreground)] w-8 text-right">{conv}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/?cidade=${encodeURIComponent(c.cidade)}`}
                          className="text-xs text-[var(--primary)] hover:underline font-bold whitespace-nowrap"
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {cidadesFiltradas.length === 0 && (
              <div className="text-center py-12 text-[var(--muted-foreground)]">
                <MapPin className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>Nenhuma cidade encontrada.</p>
              </div>
            )}
          </div>

          {/* Legenda */}
          <div className="px-5 py-3 border-t border-[var(--border)] flex flex-wrap gap-4 text-xs text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Alta prioridade sem visita</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Conversão ≥ 30%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Conversão 10–29%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-600" /> Conversão &lt; 10%</span>
          </div>
        </div>

      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, color, className = ''
}: {
  icon: React.ReactNode; label: string; value: number; sub: string; color: string; className?: string;
}) {
  return (
    <div className={`glass-panel rounded-2xl p-4 space-y-1 ${className}`}>
      <div className={`flex items-center gap-2 ${color}`}>
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs text-[var(--muted-foreground)]">{sub}</p>
    </div>
  );
}

function PrioCard({
  label, value, total, barColor, textColor, badgeBg
}: {
  label: string; value: number; total: number;
  barColor: string; textColor: string; badgeBg: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`${badgeBg} rounded-xl p-4 space-y-3 border border-[var(--border)]`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>{label}</span>
        <span className={`text-2xl font-bold ${textColor}`}>{value}</span>
      </div>
      <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">{pct}% do total ativo</p>
    </div>
  );
}
