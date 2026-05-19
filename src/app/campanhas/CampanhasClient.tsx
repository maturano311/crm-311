'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Target, Plus, X, ChevronDown, ChevronUp,
  Calendar, Users, Power, Home,
  UserCheck, Megaphone, ArrowRight, Calculator
} from 'lucide-react';
import { criarCampanha, toggleCampanhaAtiva, encerrarCampanha, ativarCampanhaComPreco } from '../actions/parceiros';

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
  rede: string | null;
  preco_base: number | null;
  bonificacao_pct: number | null;
}

function calcBonif(preco: number, bonif: number) {
  if (!preco || !bonif || bonif <= 0 || bonif >= 100) return null;
  const N = Math.round((1 / (bonif / 100)) - 1);
  if (N <= 0) return null;
  return {
    N,
    desconto: (1 / (N + 1)) * 100,
    precoUni: preco * N / (N + 1),
  };
}

function TabelaQuantidades({ preco, bonif }: { preco: number; bonif: number }) {
  const r = calcBonif(preco, bonif);
  if (!r) return null;
  return (
    <div style={{ borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--muted)', padding: '0.3rem 0.6rem', display: 'flex', gap: '1rem' }}>
        {['Paga', 'Leva', 'Potes', 'Valor pago'].map(h => (
          <span key={h} style={{ flex: 1, fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
        ))}
      </div>
      {Array.from({ length: 7 }, (_, i) => i + 1).map(mult => (
        <div key={mult} style={{ display: 'flex', gap: '1rem', padding: '0.4rem 0.6rem', borderTop: '1px solid var(--border)', background: mult === 1 ? 'rgba(0,230,118,0.05)' : 'transparent' }}>
          <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{r.N * mult} fardos</span>
          <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{(r.N + 1) * mult} fardos</span>
          <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{(r.N + 1) * mult * 4} potes</span>
          <span style={{ flex: 1, fontSize: '0.8rem' }}>R$ {(r.precoUni * r.N * mult * 4).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function statusLabel(c: Campanha) {
  if (!c.ativa) return { label: 'Sugestão', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
  if (c.dias_restantes < 0) return { label: 'Vencida', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  if (c.dias_restantes === 0) return { label: 'Hoje!', color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
  if (c.dias_restantes <= 7) return { label: `${c.dias_restantes}d restantes`, color: '#facc15', bg: 'rgba(250,204,21,0.12)' };
  return { label: `${c.dias_restantes}d restantes`, color: '#00e676', bg: 'rgba(0,230,118,0.10)' };
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--background)', border: '1px solid var(--border)',
  borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.88rem',
  color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.68rem', fontWeight: 700,
  color: 'var(--muted-foreground)', textTransform: 'uppercase',
  letterSpacing: '0.07em', marginBottom: '0.35rem',
};

export default function CampanhasClient({
  campanhas: initial,
  redes,
}: {
  campanhas: Campanha[];
  redes: string[];
}) {
  const [campanhas, setCampanhas] = useState<Campanha[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<'todas' | 'ativas' | 'sugestoes'>('todas');

  // Form nova campanha
  const [form, setForm] = useState({
    nome: '', data_alvo: '', descricao: '', dias_antecedencia: 7,
  });
  const [saving, setSaving] = useState(false);
  const formValido = !!(form.nome.trim() && form.data_alvo);

  // Form de ativação inline (por card)
  const [ativForm, setAtivForm] = useState({ rede: '', preco: '', bonif: '' });
  const ativCalc = calcBonif(
    parseFloat(ativForm.preco.replace(',', '.')),
    parseFloat(ativForm.bonif.replace(',', '.'))
  );
  const ativValido = !!(ativForm.rede && ativCalc);

  const handleExpand = (id: number | null) => {
    setExpandedId(prev => {
      const next = prev === id ? null : id;
      if (next) {
        const c = campanhas.find(x => x.id === next);
        if (c) {
          setAtivForm({
            rede: c.rede || '',
            preco: c.preco_base ? String(c.preco_base) : '',
            bonif: c.bonificacao_pct ? String(c.bonificacao_pct) : '',
          });
        }
      }
      return next;
    });
  };

  const campanhasFiltradas = campanhas.filter(c => {
    if (filtro === 'ativas') return c.ativa;
    if (filtro === 'sugestoes') return !c.ativa;
    return true;
  });

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValido) return;
    setSaving(true);
    const res = await criarCampanha({
      nome: form.nome,
      data_alvo: form.data_alvo,
      descricao: form.descricao,
      dias_antecedencia: form.dias_antecedencia,
    });
    if (res.success && res.campanha) {
      setCampanhas(prev => [...prev, {
        ...res.campanha!,
        total_abordados: 0,
        total_compraram: 0,
      }]);
      setShowForm(false);
      setForm({ nome: '', data_alvo: '', descricao: '', dias_antecedencia: 7 });
    } else {
      alert('Erro ao criar campanha: ' + res.error);
    }
    setSaving(false);
  };

  const handlePausar = async (c: Campanha) => {
    setLoadingId(c.id);
    const res = await toggleCampanhaAtiva(c.id, false);
    if (res.success) setCampanhas(prev => prev.map(x => x.id === c.id ? { ...x, ativa: false } : x));
    setLoadingId(null);
  };

  const handleAtivar = async (c: Campanha) => {
    if (!ativValido) return;
    setLoadingId(c.id);
    const preco = parseFloat(ativForm.preco.replace(',', '.'));
    const bonif = parseFloat(ativForm.bonif.replace(',', '.'));
    const res = await ativarCampanhaComPreco(c.id, ativForm.rede, preco, bonif);
    if (res.success) {
      setCampanhas(prev => prev.map(x =>
        x.id === c.id ? { ...x, ativa: true, rede: ativForm.rede, preco_base: preco, bonificacao_pct: bonif } : x
      ));
      setExpandedId(null);
    } else {
      alert('Erro ao ativar: ' + (res as any).error);
    }
    setLoadingId(null);
  };

  const handleDuplicar = async (c: Campanha) => {
    const res = await criarCampanha({ nome: c.nome, data_alvo: c.data_alvo.slice(0, 10), descricao: c.descricao || undefined, dias_antecedencia: c.dias_antecedencia });
    if (res.success && res.campanha) {
      const nova = { ...res.campanha!, total_abordados: 0, total_compraram: 0 };
      setCampanhas(prev => [...prev, nova]);
      setExpandedId(null);
      setTimeout(() => handleExpand(nova.id), 50);
    } else {
      alert('Erro: ' + res.error);
    }
  };

  const handleEncerrar = async (c: Campanha) => {
    if (!confirm(`Encerrar a campanha "${c.nome}"?`)) return;
    setLoadingId(c.id);
    await encerrarCampanha(c.id);
    setCampanhas(prev => prev.map(x => x.id === c.id ? { ...x, ativa: false } : x));
    setLoadingId(null);
  };

  const taxaConversao = (c: Campanha) =>
    c.total_abordados > 0 ? Math.round((c.total_compraram / c.total_abordados) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-geist-sans), Arial, sans-serif', paddingBottom: '5rem' }}>

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
              {campanhas.filter(c => c.ativa).length} ativas · {campanhas.filter(c => !c.ativa).length} sugestões
            </p>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="magnetic-button flex items-center gap-2 bg-[var(--primary)] text-black px-5 py-2.5 rounded-full font-bold text-sm hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" /> Nova Campanha
          </button>
        </div>

        {/* Formulário de Nova Campanha */}
        {showForm && (
          <div className="glass-panel stagger-item" style={{ borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(0,230,118,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Target className="w-4 h-4" style={{ color: 'var(--primary)' }} /> Nova Campanha
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-[var(--muted)] rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCriar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Nome */}
              <div>
                <label style={labelStyle}>Nome da Campanha *</label>
                <input type="text" required placeholder="Ex: Copa do Mundo 2026, Festa Junina..."
                  value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>

              {/* Data + Antecedência */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Data Alvo *</label>
                  <input type="date" required value={form.data_alvo}
                    onChange={e => setForm(f => ({ ...f, data_alvo: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Antecedência</label>
                  <select value={form.dias_antecedencia}
                    onChange={e => setForm(f => ({ ...f, dias_antecedencia: Number(e.target.value) }))} style={inputStyle}>
                    {[3, 5, 7, 10, 14, 21, 30].map(d => <option key={d} value={d}>{d} dias antes</option>)}
                  </select>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label style={labelStyle}>Descrição (opcional)</label>
                <textarea placeholder="Objetivo da campanha..."
                  value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              <button type="submit" disabled={saving || !formValido}
                className="magnetic-button w-full bg-[var(--primary)] text-black py-3 rounded-xl font-bold text-base disabled:opacity-40 transition-all hover:opacity-90">
                {saving ? 'Criando...' : '✓ Criar Campanha'}
              </button>
            </form>
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {([
            { key: 'todas', label: 'Todas' },
            { key: 'ativas', label: 'Ativas' },
            { key: 'sugestoes', label: 'Sugestões' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              style={{
                padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700,
                border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                borderColor: filtro === f.key ? 'var(--primary)' : 'var(--border)',
                background: filtro === f.key ? 'var(--primary)' : 'transparent',
                color: filtro === f.key ? '#000' : 'var(--muted-foreground)',
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {campanhasFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted-foreground)' }}>
              <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p style={{ fontWeight: 600 }}>Nenhuma campanha aqui.</p>
            </div>
          ) : campanhasFiltradas.map(c => {
            const st = statusLabel(c);
            const taxa = taxaConversao(c);
            const isExpanded = expandedId === c.id;
            const isLoading = loadingId === c.id;

            return (
              <div key={c.id} className="glass-panel stagger-item"
                style={{
                  borderRadius: '14px',
                  border: `1px solid ${c.ativa ? 'rgba(0,230,118,0.2)' : 'rgba(107,114,128,0.15)'}`,
                  overflow: 'hidden',
                }}>

                {/* Cabeçalho */}
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                  onClick={() => handleExpand(c.id)}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                    background: c.ativa ? 'rgba(0,230,118,0.12)' : 'rgba(107,114,128,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Target className="w-4 h-4" style={{ color: c.ativa ? 'var(--primary)' : '#6b7280' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.nome}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <Calendar className="w-3 h-3" />
                      {new Date(c.data_alvo).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })}
                      {c.rede && <span style={{ color: '#a78bfa' }}>· {c.rede.replace('TABELA ', '')}</span>}
                      {c.preco_base && <span style={{ color: 'var(--primary)', fontWeight: 700 }}>R$ {Number(c.preco_base).toFixed(2)}</span>}
                      <span style={{ color: st.color, background: st.bg, padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 700 }}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  <div style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Detalhe expandido */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

                    {c.descricao && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', fontStyle: 'italic', borderLeft: '2px solid var(--primary)', paddingLeft: '0.75rem', lineHeight: 1.5 }}>
                        {c.descricao}
                      </p>
                    )}

                    {/* Métricas — só para ativas */}
                    {c.ativa && (
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
                    )}

                    {/* Calculadora de ativação — sempre visível quando expandido */}
                    <div style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: '12px', padding: '1rem' }}>
                      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Calculator className="w-3 h-3" /> Bonificação
                      </p>

                      {/* Tabela */}
                      <div style={{ marginBottom: '0.6rem' }}>
                        <label style={labelStyle}>Tabela de Preço</label>
                        <select value={ativForm.rede} onChange={e => setAtivForm(f => ({ ...f, rede: e.target.value }))}
                          style={{ ...inputStyle, color: ativForm.rede ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                          <option value="">Selecione...</option>
                          {redes.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>

                      <div style={{ marginBottom: '0.6rem' }}>
                        <label style={labelStyle}>Preço Base (R$)</label>
                        <input type="text" inputMode="decimal" placeholder="0,00"
                          value={ativForm.preco} onChange={e => setAtivForm(f => ({ ...f, preco: e.target.value }))}
                          style={inputStyle}
                          onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                          onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                      </div>
                      <div style={{ marginBottom: '0.6rem' }}>
                        <label style={labelStyle}>Bonificação (%)</label>
                        <input type="text" inputMode="decimal" placeholder="Ex: 10"
                          value={ativForm.bonif} onChange={e => setAtivForm(f => ({ ...f, bonif: e.target.value }))}
                          style={inputStyle}
                          onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                          onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                      </div>
                      {ativCalc && <TabelaQuantidades preco={parseFloat(ativForm.preco.replace(',', '.'))} bonif={parseFloat(ativForm.bonif.replace(',', '.'))} />}
                    </div>

                    {/* Ações */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.1rem' }}>
                      {c.ativa && (
                        <Link href={`/campanhas/${c.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                            border: '1px solid var(--primary)', background: 'var(--primary)', color: '#000',
                            textDecoration: 'none', transition: 'all 0.15s',
                          }}>
                          <Users className="w-3.5 h-3.5" /> Gerenciar Parceiros <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}

                      <button onClick={() => handleAtivar(c)} disabled={isLoading || !ativValido}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                          border: '1px solid var(--primary)', background: ativValido ? 'var(--primary)' : 'transparent',
                          color: ativValido ? '#000' : 'var(--muted-foreground)',
                          cursor: ativValido ? 'pointer' : 'not-allowed',
                          opacity: isLoading ? 0.5 : 1,
                        }}>
                        <Power className="w-3.5 h-3.5" /> {c.ativa ? 'Atualizar' : 'Ativar Campanha'}
                      </button>

                      {c.ativa && (
                        <button onClick={() => handlePausar(c)} disabled={isLoading}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                            border: '1px solid #6b7280', background: 'transparent', color: '#6b7280',
                            cursor: 'pointer', opacity: isLoading ? 0.5 : 1,
                          }}>
                          <Power className="w-3.5 h-3.5" /> Pausar
                        </button>
                      )}

                      {c.ativa && (
                        <button onClick={() => handleEncerrar(c)} disabled={isLoading}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                            border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#ef4444',
                            cursor: 'pointer', opacity: isLoading ? 0.5 : 1,
                          }}>
                          <X className="w-3.5 h-3.5" /> Encerrar
                        </button>
                      )}

                      <button onClick={() => handleDuplicar(c)} disabled={isLoading}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                          border: '1px solid #a78bfa', background: 'transparent', color: '#a78bfa',
                          cursor: 'pointer', opacity: isLoading ? 0.5 : 1,
                        }}>
                        <Plus className="w-3.5 h-3.5" /> Outra tabela
                      </button>

                      <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}>
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
