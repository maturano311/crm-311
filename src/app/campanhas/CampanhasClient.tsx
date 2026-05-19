'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Target, Plus, X, ChevronDown, ChevronUp,
  Calendar, Users, TrendingUp, Power, Home,
  UserCheck, Route, Search, Megaphone, ArrowRight, Calculator
} from 'lucide-react';
import { criarCampanha, toggleCampanhaAtiva, encerrarCampanha } from '../actions/parceiros';

interface Campanha {
  id: number;
  nome: string;
  data_alvo: string;
  descricao: string | null;
  dias_antecedencia: number;
  ativa: boolean;
  criado_em: string;
  dias_restantes: number;
  total_abordados: number;
  total_compraram: number;
}

function statusLabel(c: Campanha) {
  if (!c.ativa) return { label: 'Encerrada', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
  if (c.dias_restantes < 0) return { label: 'Vencida', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  if (c.dias_restantes === 0) return { label: 'Hoje!', color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
  if (c.dias_restantes <= 7) return { label: `${c.dias_restantes}d restantes`, color: '#facc15', bg: 'rgba(250,204,21,0.12)' };
  return { label: `${c.dias_restantes}d restantes`, color: '#00e676', bg: 'rgba(0,230,118,0.10)' };
}

export default function CampanhasClient({ campanhas: initial }: { campanhas: Campanha[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [campanhas, setCampanhas] = useState<Campanha[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<'todas' | 'ativas' | 'encerradas'>('ativas');

  // Form de nova campanha
  const [form, setForm] = useState({
    nome: '',
    data_alvo: '',
    descricao: '',
    dias_antecedencia: 7,
  });
  const [saving, setSaving] = useState(false);

  // Calculadora de bonificação
  const [calcPreco, setCalcPreco] = useState('');
  const [calcBonif, setCalcBonif] = useState('');

  const calcResult = (() => {
    const preco = parseFloat(calcPreco.replace(',', '.'));
    const bonif = parseFloat(calcBonif.replace(',', '.'));
    if (!preco || !bonif || bonif <= 0 || bonif >= 100) return null;
    const N = Math.round((1 / (bonif / 100)) - 1);
    if (N <= 0) return null;
    const descontoReal = (1 / (N + 1)) * 100;
    const precoUni = preco * N / (N + 1);
    const precoFardo = precoUni * 4;
    return { N, descontoReal, precoUni, precoFardo };
  })();

  const campanhasFiltradas = campanhas.filter(c => {
    if (filtro === 'ativas') return c.ativa;
    if (filtro === 'encerradas') return !c.ativa;
    return true;
  });

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.data_alvo) return;
    setSaving(true);
    const res = await criarCampanha(form);
    if (res.success) {
      setShowForm(false);
      setForm({ nome: '', data_alvo: '', descricao: '', dias_antecedencia: 7 });
      startTransition(() => router.refresh());
    } else {
      alert('Erro ao criar campanha: ' + res.error);
    }
    setSaving(false);
  };

  const handleToggle = async (c: Campanha) => {
    setLoadingId(c.id);
    const res = await toggleCampanhaAtiva(c.id, !c.ativa);
    if (res.success) {
      setCampanhas(prev => prev.map(x => x.id === c.id ? { ...x, ativa: !c.ativa } : x));
    }
    setLoadingId(null);
  };

  const handleEncerrar = async (c: Campanha) => {
    if (!confirm(`Encerrar a campanha "${c.nome}"? Ela ficará arquivada e não aparecerá no painel.`)) return;
    setLoadingId(c.id);
    await encerrarCampanha(c.id);
    setCampanhas(prev => prev.map(x => x.id === c.id ? { ...x, ativa: false } : x));
    setLoadingId(null);
  };

  const taxaConversao = (c: Campanha) =>
    c.total_abordados > 0 ? Math.round((c.total_compraram / c.total_abordados) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-geist-sans), Arial, sans-serif', paddingBottom: '5rem' }}>

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 md:p-6 border-b border-[var(--border)] bg-[rgba(9,12,11,0.85)] backdrop-blur-xl sticky top-0 z-50">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-cyan-400">
            311 Representações
          </h1>
          <p className="text-[var(--muted-foreground)] text-sm font-medium flex items-center gap-1.5 mt-0.5">
            <Megaphone className="w-3.5 h-3.5" /> Gestão de Campanhas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-[var(--primary)] text-[var(--primary)] px-4 py-2 rounded-full font-bold hover:bg-[var(--primary)] hover:text-black transition-all text-sm">
            <Home className="w-4 h-4" /> Home
          </Link>
          <Link href="/leads" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] px-4 py-2 rounded-full font-bold transition-all text-sm">
            <Users className="w-4 h-4" /> Leads
          </Link>
          <Link href="/parceiros" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-cyan-500 text-cyan-400 px-4 py-2 rounded-full font-bold hover:bg-cyan-500 hover:text-black transition-all text-sm">
            <UserCheck className="w-4 h-4" /> Parceiros
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Título + Botão Nova */}
        <div className="flex items-center justify-between">
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Suas Campanhas</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
              {campanhas.filter(c => c.ativa).length} ativas · {campanhas.filter(c => !c.ativa).length} encerradas
            </p>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="magnetic-button flex items-center gap-2 bg-[var(--primary)] text-black px-5 py-2.5 rounded-full font-bold text-sm hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nova Campanha
          </button>
        </div>

        {/* Formulário de Nova Campanha */}
        {showForm && (
          <div className="glass-panel stagger-item" style={{ borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(0,230,118,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Target className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                Nova Campanha Manual
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-[var(--muted)] rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCriar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>
                  Nome da Campanha *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ação de Verão, Queima de Estoque Junho..."
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  style={{ width: '100%', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.9rem', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>
                    Data Alvo *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.data_alvo}
                    onChange={e => setForm(f => ({ ...f, data_alvo: e.target.value }))}
                    style={{ width: '100%', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.9rem', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>
                    Antecedência (dias)
                  </label>
                  <select
                    value={form.dias_antecedencia}
                    onChange={e => setForm(f => ({ ...f, dias_antecedencia: Number(e.target.value) }))}
                    style={{ width: '100%', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.9rem', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
                  >
                    {[3, 5, 7, 10, 14, 21, 30].map(d => (
                      <option key={d} value={d}>{d} dias antes</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>
                  Descrição / Objetivo (opcional)
                </label>
                <textarea
                  placeholder="Ex: Oferecer kit 3x2 nos sabores de verão para todos os parceiros da região..."
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={3}
                  style={{ width: '100%', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.85rem', color: 'var(--foreground)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <button
                type="submit"
                disabled={saving || !form.nome.trim() || !form.data_alvo}
                className="magnetic-button w-full bg-[var(--primary)] text-black py-3 rounded-xl font-bold text-base disabled:opacity-50 transition-all hover:opacity-90"
              >
                {saving ? 'Criando...' : '✓ Criar Campanha'}
              </button>
            </form>
          </div>
        )}

        {/* Calculadora de Bonificação */}
        <div className="glass-panel stagger-item" style={{ borderRadius: '16px', padding: '1.25rem 1.5rem', border: '1px solid rgba(0,230,118,0.15)' }}>
          <h3 style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Calculator className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            Calculadora de Bonificação
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: calcResult ? '1rem' : 0 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>
                Preço Base (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={calcPreco}
                onChange={e => setCalcPreco(e.target.value)}
                style={{ width: '100%', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.8rem', fontSize: '0.9rem', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>
                Bonificação (%)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex: 25"
                value={calcBonif}
                onChange={e => setCalcBonif(e.target.value)}
                style={{ width: '100%', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.8rem', fontSize: '0.9rem', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>

          {calcResult && (
            <div style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--primary)', margin: 0 }}>
                Compra {calcResult.N} fardo{calcResult.N > 1 ? 's' : ''}, leva {calcResult.N + 1}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {[
                  { label: 'Preço / unid.', value: `R$ ${calcResult.precoUni.toFixed(2)}` },
                  { label: 'Preço / fardo', value: `R$ ${calcResult.precoFardo.toFixed(2)}` },
                  { label: 'Desconto real', value: `${calcResult.descontoReal.toFixed(1)}%` },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--muted)', borderRadius: '10px', padding: '0.55rem 0.65rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{m.label}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--foreground)' }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['ativas', 'todas', 'encerradas'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '999px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all 0.15s',
                borderColor: filtro === f ? 'var(--primary)' : 'var(--border)',
                background: filtro === f ? 'var(--primary)' : 'transparent',
                color: filtro === f ? '#000' : 'var(--muted-foreground)',
              }}
            >
              {f === 'ativas' ? 'Ativas' : f === 'encerradas' ? 'Encerradas' : 'Todas'}
            </button>
          ))}
        </div>

        {/* Lista de Campanhas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {campanhasFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted-foreground)' }}>
              <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p style={{ fontWeight: 600 }}>Nenhuma campanha aqui.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>Crie uma usando o botão "Nova Campanha".</p>
            </div>
          ) : campanhasFiltradas.map(c => {
            const st = statusLabel(c);
            const taxa = taxaConversao(c);
            const isExpanded = expandedId === c.id;
            const isLoading = loadingId === c.id;

            return (
              <div
                key={c.id}
                className="glass-panel stagger-item"
                style={{
                  borderRadius: '14px',
                  border: `1px solid ${c.ativa ? 'rgba(0,230,118,0.15)' : 'rgba(107,114,128,0.15)'}`,
                  overflow: 'hidden',
                  opacity: c.ativa ? 1 : 0.6,
                  transition: 'opacity 0.2s',
                }}
              >
                {/* Cabeçalho do card */}
                <div
                  style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  {/* Ícone */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: c.ativa ? 'rgba(0,230,118,0.12)' : 'rgba(107,114,128,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Target className="w-4 h-4" style={{ color: c.ativa ? 'var(--primary)' : '#6b7280' }} />
                  </div>

                  {/* Nome + status */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.nome}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <Calendar className="w-3 h-3" />
                      {new Date(c.data_alvo).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })}
                      <span style={{ color: st.color, background: st.bg, padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 700 }}>
                        {st.label}
                      </span>
                    </div>
                  </div>

                  {/* Chevron */}
                  <div style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Detalhe expandido */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

                    {/* Descrição */}
                    {c.descricao && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', fontStyle: 'italic', borderLeft: '2px solid var(--primary)', paddingLeft: '0.75rem', lineHeight: 1.5 }}>
                        {c.descricao}
                      </p>
                    )}

                    {/* Métricas */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                      {[
                        { label: 'Abordados', value: c.total_abordados, color: '#60a5fa' },
                        { label: 'Compraram', value: c.total_compraram, color: 'var(--primary)' },
                        { label: 'Conversão', value: `${taxa}%`, color: taxa >= 50 ? 'var(--primary)' : '#facc15' },
                      ].map(m => (
                        <div key={m.label} style={{ background: 'var(--muted)', borderRadius: '10px', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                          <div style={{ fontWeight: 700, color: m.color, fontSize: '1.1rem' }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Ações */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
                      {/* Destaque: Gerenciar Parceiros */}
                      <Link
                        href={`/campanhas/${c.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                          border: '1px solid var(--primary)',
                          background: 'var(--primary)', color: '#000',
                          textDecoration: 'none', transition: 'all 0.15s',
                        }}
                      >
                        <Users className="w-3.5 h-3.5" />
                        Gerenciar Parceiros
                        <ArrowRight className="w-3 h-3" />
                      </Link>

                      <button
                        onClick={() => handleToggle(c)}
                        disabled={isLoading}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                          border: `1px solid ${c.ativa ? '#6b7280' : 'var(--primary)'}`,
                          background: 'transparent',
                          color: c.ativa ? '#6b7280' : 'var(--primary)',
                          cursor: 'pointer', transition: 'all 0.15s',
                          opacity: isLoading ? 0.5 : 1,
                        }}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {c.ativa ? 'Pausar' : 'Reativar'}
                      </button>

                      {c.ativa && (
                        <button
                          onClick={() => handleEncerrar(c)}
                          disabled={isLoading}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                            border: '1px solid rgba(239,68,68,0.4)',
                            background: 'transparent', color: '#ef4444',
                            cursor: 'pointer', transition: 'all 0.15s',
                            opacity: isLoading ? 0.5 : 1,
                          }}
                        >
                          <X className="w-3.5 h-3.5" />
                          Encerrar
                        </button>
                      )}

                      <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        Criada em {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
