'use client';

import { useState, useMemo, useOptimistic, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Target, Calendar, Users, TrendingUp,
  Search, CheckCircle, XCircle, Plus, Minus,
  MapPin, Phone, ShoppingCart, Megaphone
} from 'lucide-react';
import { adicionarParceiroCampanha, removerParceiroDaCampanha, marcarParceiroNaCampanha } from '../../actions/parceiros';

interface Parceiro {
  id: number;
  nome_fantasia: string;
  cidade: string | null;
  bairro: string | null;
  regiao: string | null;
  perfil: string | null;
  telefone: string | null;
  tabela_preco: string | null;
  abordado: boolean | null;
  comprou: boolean | null;
  data_abordagem: string | null;
  na_campanha: boolean;
}

interface Campanha {
  id: number;
  nome: string;
  data_alvo: string;
  descricao: string | null;
  ativa: boolean;
  rede: string | null;
  preco_base: number | null;
  bonificacao_pct: number | null;
  dias_restantes: number;
  total_abordados: number;
  total_compraram: number;
  total_participantes: number;
}

function statusCor(dias: number, ativa: boolean) {
  if (!ativa) return { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', label: 'Encerrada' };
  if (dias < 0) return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Vencida' };
  if (dias === 0) return { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'Hoje!' };
  if (dias <= 7) return { color: '#facc15', bg: 'rgba(250,204,21,0.12)', label: `${dias}d restantes` };
  return { color: '#00e676', bg: 'rgba(0,230,118,0.10)', label: `${dias}d restantes` };
}

export default function CampanhaDetalheClient({
  campanha,
  parceiros: initialParceiros,
}: {
  campanha: Campanha;
  parceiros: Parceiro[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [parceiros, setParceiros] = useState<Parceiro[]>(initialParceiros);
  const [busca, setBusca] = useState('');
  const [filtroRegiao, setFiltroRegiao] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('varejo');
  const [filtroTabela, setFiltroTabela] = useState(campanha.rede || '');
  const [aba, setAba] = useState<'na_campanha' | 'adicionar'>('na_campanha');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const st = statusCor(campanha.dias_restantes, campanha.ativa);

  // Derivados
  const naCampanha = useMemo(() => parceiros.filter(p => p.na_campanha), [parceiros]);
  const foraDaCampanha = useMemo(() => parceiros.filter(p => !p.na_campanha), [parceiros]);

  // Regiões únicas disponíveis
  const regioes = useMemo(() =>
    [...new Set(parceiros.map(p => p.regiao).filter(Boolean) as string[])].sort()
  , [parceiros]);

  // Perfis únicos disponíveis
  const perfis = useMemo(() =>
    [...new Set(parceiros.map(p => p.perfil).filter(Boolean) as string[])].sort()
  , [parceiros]);

  // Tabelas de preço únicas (proxy de rede)
  const tabelas = useMemo(() =>
    [...new Set(parceiros.map(p => p.tabela_preco).filter(Boolean) as string[])].sort()
  , [parceiros]);

  const buscarEm = (lista: Parceiro[]) => {
    let result = lista;
    if (filtroRegiao) result = result.filter(p => p.regiao === filtroRegiao);
    if (filtroPerfil) result = result.filter(p => p.perfil === filtroPerfil);
    if (filtroTabela) result = result.filter(p => p.tabela_preco === filtroTabela);
    const q = busca.toLowerCase();
    if (!q) return result;
    return result.filter(p =>
      [p.nome_fantasia, p.cidade, p.bairro, p.regiao, p.perfil, p.tabela_preco]
        .some(v => v && v.toLowerCase().includes(q))
    );
  };

  // Handlers
  const handleAdicionar = async (parceiroId: number) => {
    setLoadingId(parceiroId);
    const res = await adicionarParceiroCampanha(campanha.id, parceiroId);
    if (res.success) {
      setParceiros(prev =>
        prev.map(p => p.id === parceiroId ? { ...p, na_campanha: true, abordado: false, comprou: false } : p)
      );
    }
    setLoadingId(null);
  };

  const handleRemover = async (parceiroId: number) => {
    setLoadingId(parceiroId);
    const res = await removerParceiroDaCampanha(campanha.id, parceiroId);
    if (res.success) {
      setParceiros(prev =>
        prev.map(p => p.id === parceiroId ? { ...p, na_campanha: false, abordado: null, comprou: null, data_abordagem: null } : p)
      );
    }
    setLoadingId(null);
  };

  const handleMarcarComprou = async (parceiroId: number, comprou: boolean) => {
    setLoadingId(parceiroId);
    const res = await marcarParceiroNaCampanha(campanha.id, parceiroId, comprou);
    if (res.success) {
      const hoje = new Date().toISOString().split('T')[0];
      setParceiros(prev =>
        prev.map(p => p.id === parceiroId
          ? { ...p, abordado: true, comprou, data_abordagem: hoje }
          : p
        )
      );
    }
    setLoadingId(null);
  };

  const taxa = campanha.total_participantes > 0
    ? Math.round((campanha.total_compraram / campanha.total_participantes) * 100)
    : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-geist-sans), Arial, sans-serif', paddingBottom: '5rem' }}>

      {/* Header */}
      <header className="flex items-center justify-between gap-4 p-4 md:p-5 border-b border-[var(--border)] bg-[rgba(9,12,11,0.88)] backdrop-blur-xl sticky top-0 z-50">
        <Link
          href="/campanhas"
          className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors font-bold text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Campanhas
        </Link>
        <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
          style={{ color: st.color, background: st.bg }}>
          {st.label}
        </span>
      </header>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Cabeçalho da Campanha */}
        <div className="glass-panel stagger-item" style={{ borderRadius: '16px', padding: '1.5rem', borderColor: 'rgba(0,230,118,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0,230,118,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Target className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{campanha.nome}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                <Calendar className="w-3.5 h-3.5" />
                {new Date(campanha.data_alvo).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              {campanha.descricao && (
                <p style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.5, borderLeft: '2px solid var(--primary)', paddingLeft: '0.6rem', fontStyle: 'italic' }}>
                  {campanha.descricao}
                </p>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '1.25rem' }}>
            {[
              { label: 'Participantes', value: campanha.total_participantes, color: 'var(--foreground)' },
              { label: 'Abordados', value: campanha.total_abordados, color: '#60a5fa' },
              { label: 'Compraram', value: campanha.total_compraram, color: 'var(--primary)' },
              { label: 'Conversão', value: `${taxa}%`, color: taxa >= 50 ? 'var(--primary)' : '#facc15' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--muted)', borderRadius: '10px', padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{m.label}</div>
                <div style={{ fontWeight: 700, color: m.color, fontSize: '1.05rem' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Abas + Busca */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {[
              { key: 'na_campanha', label: `Na Campanha (${naCampanha.length})` },
              { key: 'adicionar', label: `Adicionar (${foraDaCampanha.length})` },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setAba(t.key as any); setBusca(''); }}
                style={{
                  padding: '0.45rem 1.1rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
                  border: '1px solid',
                  borderColor: aba === t.key ? 'var(--primary)' : 'var(--border)',
                  background: aba === t.key ? 'var(--primary)' : 'transparent',
                  color: aba === t.key ? '#000' : 'var(--muted-foreground)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search + Filtro Região */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search className="w-4 h-4" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                placeholder="Buscar por nome, cidade..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{
                  width: '100%', background: 'var(--background)', border: '1px solid var(--border)',
                  borderRadius: '999px', padding: '0.55rem 1rem 0.55rem 2.4rem',
                  fontSize: '0.85rem', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {regioes.length > 0 && (
              <select
                value={filtroRegiao}
                onChange={e => setFiltroRegiao(e.target.value)}
                style={{
                  background: 'var(--background)', border: `1px solid ${filtroRegiao ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: '999px', padding: '0.55rem 1rem',
                  fontSize: '0.82rem', color: filtroRegiao ? 'var(--primary)' : 'var(--muted-foreground)',
                  outline: 'none', cursor: 'pointer', fontWeight: filtroRegiao ? 700 : 400,
                }}
              >
                <option value="">Todas as Regiões</option>
                {regioes.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}

            {perfis.length > 0 && (
              <select
                value={filtroPerfil}
                onChange={e => setFiltroPerfil(e.target.value)}
                style={{
                  background: 'var(--background)', border: `1px solid ${filtroPerfil ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: '999px', padding: '0.55rem 1rem',
                  fontSize: '0.82rem', color: filtroPerfil ? 'var(--primary)' : 'var(--muted-foreground)',
                  outline: 'none', cursor: 'pointer', fontWeight: filtroPerfil ? 700 : 400,
                }}
              >
                <option value="">Todos os Tipos</option>
                {perfis.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}

            {tabelas.length > 0 && (
              <select
                value={filtroTabela}
                onChange={e => setFiltroTabela(e.target.value)}
                style={{
                  background: 'var(--background)', border: `1px solid ${filtroTabela ? '#a78bfa' : 'var(--border)'}`,
                  borderRadius: '999px', padding: '0.55rem 1rem',
                  fontSize: '0.82rem', color: filtroTabela ? '#a78bfa' : 'var(--muted-foreground)',
                  outline: 'none', cursor: 'pointer', fontWeight: filtroTabela ? 700 : 400,
                }}
              >
                <option value="">Todas as Redes</option>
                {tabelas.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── ABA: NA CAMPANHA ── */}
        {aba === 'na_campanha' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {buscarEm(naCampanha).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted-foreground)' }}>
                <Users className="w-9 h-9 mx-auto mb-2 opacity-25" />
                <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {busca ? 'Nenhum resultado.' : 'Nenhum parceiro adicionado ainda.'}
                </p>
                {!busca && (
                  <p style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>
                    Vá para a aba <strong>"Adicionar"</strong> para incluir parceiros.
                  </p>
                )}
              </div>
            ) : buscarEm(naCampanha).map(p => (
              <div
                key={p.id}
                className="glass-panel stagger-item"
                style={{
                  borderRadius: '12px', padding: '0.9rem 1rem',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  border: `1px solid ${p.comprou ? 'rgba(0,230,118,0.25)' : p.abordado ? 'rgba(96,165,250,0.2)' : 'var(--border)'}`,
                }}
              >
                {/* Status visual */}
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: p.comprou ? 'var(--primary)' : p.abordado ? '#60a5fa' : 'var(--muted-foreground)',
                }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.nome_fantasia}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.15rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {p.regiao && <span>📍 {p.regiao}</span>}
                    {p.cidade && <span>{p.cidade}</span>}
                    {campanha.rede && campanha.rede === p.tabela_preco && campanha.preco_base != null && (
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        R$ {Number(campanha.preco_base).toFixed(2)} · {campanha.bonificacao_pct}%
                      </span>
                    )}
                    {p.data_abordagem && (
                      <span style={{ color: '#60a5fa' }}>
                        Abordado em {new Date(p.data_abordagem).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações de status */}
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  {/* Comprou / Não Comprou */}
                  <button
                    onClick={() => handleMarcarComprou(p.id, true)}
                    disabled={loadingId === p.id || p.comprou === true}
                    title="Marcou pedido"
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                      background: p.comprou ? 'rgba(0,230,118,0.2)' : 'var(--muted)',
                      color: p.comprou ? 'var(--primary)' : 'var(--muted-foreground)',
                      cursor: p.comprou ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMarcarComprou(p.id, false)}
                    disabled={loadingId === p.id || (p.abordado === true && p.comprou === false)}
                    title="Abordado, não comprou"
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                      background: (p.abordado && !p.comprou) ? 'rgba(96,165,250,0.2)' : 'var(--muted)',
                      color: (p.abordado && !p.comprou) ? '#60a5fa' : 'var(--muted-foreground)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                  {/* Remover da campanha */}
                  <button
                    onClick={() => handleRemover(p.id)}
                    disabled={loadingId === p.id}
                    title="Remover da campanha"
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.25)',
                      background: 'transparent', color: '#ef4444',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                      opacity: loadingId === p.id ? 0.4 : 1,
                    }}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ABA: ADICIONAR ── */}
        {aba === 'adicionar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {buscarEm(foraDaCampanha).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted-foreground)' }}>
                <CheckCircle className="w-9 h-9 mx-auto mb-2 opacity-25" />
                <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {busca ? 'Nenhum resultado.' : 'Todos os parceiros já estão na campanha!'}
                </p>
              </div>
            ) : buscarEm(foraDaCampanha).map(p => (
              <div
                key={p.id}
                className="glass-panel stagger-item"
                style={{ borderRadius: '12px', padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
              >
                {/* Avatar letra */}
                <div style={{
                  width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                  background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.85rem', color: 'var(--muted-foreground)',
                }}>
                  {p.nome_fantasia.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.nome_fantasia}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', marginTop: '0.1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {p.regiao && <span>📍 {p.regiao}</span>}
                    {p.cidade && <span>{p.cidade}</span>}
                    {p.perfil && <span style={{ background: 'var(--muted)', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>{p.perfil}</span>}
                    {campanha.rede && campanha.rede === p.tabela_preco && campanha.preco_base != null ? (
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        R$ {Number(campanha.preco_base).toFixed(2)} · {campanha.bonificacao_pct}%
                      </span>
                    ) : (
                      <span style={{ color: '#6b7280' }}>{p.tabela_preco || 'sem tabela'}</span>
                    )}
                  </div>
                </div>

                {/* Botão adicionar */}
                <button
                  onClick={() => handleAdicionar(p.id)}
                  disabled={loadingId === p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                    border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)',
                    cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                    opacity: loadingId === p.id ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary)'; (e.currentTarget as HTMLButtonElement).style.color = '#000'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)'; }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {loadingId === p.id ? '...' : 'Adicionar'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Legenda de status */}
        {aba === 'na_campanha' && naCampanha.length > 0 && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} /> Comprou
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} /> Abordado
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--muted-foreground)', display: 'inline-block' }} /> Aguardando
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', marginLeft: 'auto' }}>
              <ShoppingCart className="w-3 h-3 inline mr-1" />= Comprou &nbsp;
              <XCircle className="w-3 h-3 inline mr-1" />= Não comprou &nbsp;
              <Minus className="w-3 h-3 inline mr-1" />= Remover
            </span>
          </div>
        )}

      </main>
    </div>
  );
}
