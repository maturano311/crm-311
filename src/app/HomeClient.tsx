'use client';

import Link from 'next/link';
import { Users, Route, Search, Target, UserCheck, ClipboardList, AlertTriangle, Calendar, Megaphone } from 'lucide-react';

interface HomeProps {
  leads: {
    total: number;         // só ativos (sem descartados)
    a_prospectar: number;
    em_andamento: number;
    clientes: number;
    descartados: number;   // campo separado para mini-indicador
    prioridade_alta: number;
    prioridade_media: number;
    prioridade_baixa: number;
    agendados_hoje: number;
  };
  parceiros: {
    total_ativos: number;
    visitados_mes: number;
    compraram_mes: number;
    sem_visita_15d: number;
    ticket_medio_mes: string | null;
    ticket_medio_geral: string | null;
  };
  campanhas: {
    id: number;
    nome: string;
    dias_restantes: number;
    total_abordados: number;
    total_compraram: number;
  }[];
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="glass-panel ag-card stagger-item flex flex-col gap-2 p-4 md:p-5 rounded-[var(--radius)]">
      <span className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest font-bold">
        {label}
      </span>
      <span 
        className="text-2xl xl:text-3xl font-extrabold truncate leading-none" 
        style={{ color: accent ?? 'var(--foreground)' }}
        title={String(value)}
      >
        {value}
      </span>
      {sub && (
        <span className="text-xs text-[var(--muted-foreground)]">{sub}</span>
      )}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  href,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="glass-panel stagger-item"
      style={{
        borderRadius: 'calc(var(--radius) + 8px)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem 1rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
          {icon}
          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--foreground)' }}>{title}</span>
        </div>
        <Link
          href={href}
          className="magnetic-button"
          style={{
            fontSize: '0.75rem',
            color: 'var(--primary)',
            textDecoration: 'none',
            border: '1px solid var(--primary)',
            borderRadius: '999px',
            padding: '0.3rem 0.8rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            display: 'inline-block',
          }}
        >
          VER TUDO →
        </Link>
      </div>

      {/* Body */}
      <div style={{ padding: '1.5rem' }}>{children}</div>
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ position: 'relative', height: '8px', background: 'var(--input)', borderRadius: '999px', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: '999px',
          transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </div>
  );
}

export default function HomeClient({ leads, parceiros, campanhas }: HomeProps) {
  const convRate =
    leads.total > 0 ? Math.round((leads.clientes / leads.total) * 100) : 0;

  const visitRate =
    parceiros.total_ativos > 0
      ? Math.round((parceiros.visitados_mes / parceiros.total_ativos) * 100)
      : 0;

  const compraRate =
    parceiros.visitados_mes > 0
      ? Math.round((parceiros.compraram_mes / parceiros.visitados_mes) * 100)
      : 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'var(--font-geist-sans), Arial, sans-serif',
        padding: '0 0 5rem',
      }}
    >
      {/* ── Header ── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 md:p-6 border-b border-[var(--border)] bg-[rgba(9,12,11,0.8)] backdrop-blur-xl sticky top-0 z-50">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-cyan-400">
            311 Representações
          </h1>
          <p className="text-[var(--muted-foreground)] text-sm md:text-base font-medium">Painel Executivo</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/leads" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-[var(--primary)] text-[var(--primary)] px-4 py-2 rounded-full font-bold hover:bg-[var(--primary)] hover:text-black transition-all text-sm shadow-[0_0_15px_rgba(0,230,118,0.1)]">
            <Users className="w-4 h-4" /> Leads
          </Link>
          <Link href="/parceiros" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-cyan-500 text-cyan-400 px-4 py-2 rounded-full font-bold hover:bg-cyan-500 hover:text-black transition-all text-sm">
            <UserCheck className="w-4 h-4" /> Parceiros
          </Link>
          <Link href="/rota" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-amber-500 text-amber-400 px-4 py-2 rounded-full font-bold hover:bg-amber-500 hover:text-black transition-all text-sm">
            <Route className="w-4 h-4" /> Minha Rota
          </Link>
          <Link href="/radar" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-violet-500 text-violet-400 px-4 py-2 rounded-full font-bold hover:bg-violet-500 hover:text-black transition-all text-sm">
            <Search className="w-4 h-4" /> Radar
          </Link>
          <Link href="/campanhas" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-orange-500 text-orange-400 px-4 py-2 rounded-full font-bold hover:bg-orange-500 hover:text-black transition-all text-sm">
            <Megaphone className="w-4 h-4" /> Campanhas
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Greeting ── */}
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
            Visão Geral
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* ── LEADS CARD ── */}
        <SectionCard title="Prospecção de Leads" icon={<ClipboardList className="w-5 h-5" />} href="/leads">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Funil — SEM descartados */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
              {[
                { label: 'A Prospectar', value: leads.a_prospectar, color: '#facc15' },
                { label: 'Em Andamento', value: leads.em_andamento, color: '#60a5fa' },
                { label: 'Convertidos', value: leads.clientes, color: 'var(--primary)' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: 'var(--muted)',
                    borderRadius: 'var(--radius)',
                    padding: '0.6rem 0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color, fontSize: '1.1rem' }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Stats linha */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.1rem', flexWrap: 'wrap', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                <strong style={{ color: 'var(--foreground)' }}>{leads.total}</strong> ativos
                {' · '}<strong style={{ color: '#ef4444' }}>{leads.prioridade_alta}</strong> <span style={{ color: '#ef4444' }}>alta</span>
                {' · '}<strong style={{ color: '#facc15' }}>{leads.prioridade_media}</strong> <span style={{ color: '#facc15' }}>média</span>
                {' · '}<strong style={{ color: 'var(--primary)' }}>{leads.prioridade_baixa}</strong> <span style={{ color: 'var(--primary)' }}>baixa</span>
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)' }}>{convRate}% conv.</span>
            </div>

            {/* Mini-indicador de arquivados */}
            {leads.descartados > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(100,100,100,0.08)',
                border: '1px solid rgba(100,100,100,0.2)',
                borderRadius: 'var(--radius)',
                padding: '0.45rem 0.85rem',
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.7rem' }}>🗄</span>
                  <strong style={{ color: 'var(--muted-foreground)' }}>{leads.descartados}</strong> descartados arquivados
                </span>
                <Link href="/leads" style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', textDecoration: 'none', border: '1px solid rgba(100,100,100,0.3)', borderRadius: '999px', padding: '0.15rem 0.5rem' }}>
                  ver
                </Link>
              </div>
            )}

            {/* Barra de Conversão */}
            <ProgressBar value={leads.clientes} max={leads.total} color="var(--primary)" />

            {/* Agendados Hoje */}
            {leads.agendados_hoje > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(0,230,118,0.08)',
                  border: '1px solid rgba(0,230,118,0.2)',
                  borderRadius: 'var(--radius)',
                  padding: '0.55rem 0.85rem',
                }}
              >
                <span style={{ color: 'var(--primary)' }}><Calendar className="w-5 h-5" /></span>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
                  {leads.agendados_hoje} agendamento{leads.agendados_hoje > 1 ? 's' : ''} para hoje
                </span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── PARCEIROS CARD ── */}
        <SectionCard title="Clientes Ativos (Parceiros)" icon={<UserCheck className="w-5 h-5" />} href="/parceiros">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
              {[
                { label: 'Ativos', value: parceiros.total_ativos, color: 'var(--foreground)' },
                { label: 'Visitados no mês', value: parceiros.visitados_mes, color: '#60a5fa' },
                { label: 'Compraram', value: parceiros.compraram_mes, color: 'var(--primary)' },
                { label: 'Sem visita +15d', value: parceiros.sem_visita_15d, color: '#ef4444' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: 'var(--muted)',
                    borderRadius: 'var(--radius)',
                    padding: '0.6rem 0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color, fontSize: '1rem' }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Ticket Médio inline */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
              <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '0.6rem 0.85rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', marginBottom: '0.15rem' }}>Ticket Médio (mês)</div>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>
                  {parceiros.ticket_medio_mes
                    ? `R$ ${Number(parceiros.ticket_medio_mes).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                    : '—'}
                </div>
              </div>
              <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '0.6rem 0.85rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', marginBottom: '0.15rem' }}>Ticket Médio (geral)</div>
                <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '1rem' }}>
                  {parceiros.ticket_medio_geral
                    ? `R$ ${Number(parceiros.ticket_medio_geral).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                    : '—'}
                </div>
              </div>
            </div>

            {/* Barras */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Cobertura de Visitas</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#60a5fa' }}>{visitRate}%</span>
              </div>
              <ProgressBar value={parceiros.visitados_mes} max={parceiros.total_ativos} color="#60a5fa" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Taxa de Compra (visitados)</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)' }}>{compraRate}%</span>
              </div>
              <ProgressBar value={parceiros.compraram_mes} max={parceiros.visitados_mes} color="var(--primary)" />
            </div>

            {/* Alerta sem visita */}
            {parceiros.sem_visita_15d > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 'var(--radius)',
                  padding: '0.55rem 0.85rem',
                }}
              >
                <span style={{ color: '#ef4444' }}><AlertTriangle className="w-5 h-5" /></span>
                <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                  {parceiros.sem_visita_15d} {parceiros.sem_visita_15d === 1 ? 'cliente' : 'clientes'} sem visita há +15 dias
                </span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── CAMPANHAS ATIVAS ── */}
        {campanhas.length > 0 && (
          <SectionCard title="Campanhas Ativas" icon={<Target className="w-5 h-5" />} href="/parceiros">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {campanhas.map((c) => {
                const taxa = c.total_abordados > 0 ? Math.round((c.total_compraram / c.total_abordados) * 100) : 0;
                return (
                  <div
                    key={c.id}
                    style={{
                      background: 'var(--muted)',
                      borderRadius: 'var(--radius)',
                      padding: '0.7rem 0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.nome}</span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: c.dias_restantes <= 3 ? '#ef4444' : '#facc15',
                          background: c.dias_restantes <= 3 ? 'rgba(239,68,68,0.12)' : 'rgba(250,204,21,0.12)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                        }}
                      >
                        {c.dias_restantes === 0 ? 'Hoje' : `${c.dias_restantes}d restantes`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                      <span>Abordados: <strong style={{ color: 'var(--foreground)' }}>{c.total_abordados}</strong></span>
                      <span>Compraram: <strong style={{ color: 'var(--primary)' }}>{c.total_compraram}</strong></span>
                      <span>Conversão: <strong style={{ color: taxa >= 50 ? 'var(--primary)' : '#facc15' }}>{taxa}%</strong></span>
                    </div>
                    <ProgressBar value={c.total_compraram} max={c.total_abordados} color="var(--primary)" />
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

      </main>
    </div>
  );
}
