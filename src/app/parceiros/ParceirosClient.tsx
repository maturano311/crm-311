'use client';

import { useState, useMemo, useEffect } from 'react';
import { Users, AlertCircle, MapPin, X, Phone, Search, Eye, Share2, DollarSign, FileText, ChevronLeft, Calendar, ShoppingCart, Navigation, Pencil } from 'lucide-react';
import { registrarVisita, buscarHistoricoVisitas, atualizarParceiro } from '../actions/parceiros';
import Link from 'next/link';

const STORAGE_KEY = 'parceiros_visitados_semana';

function getMondayStr() {
  const d = new Date();
  const day = d.getDay(); // 0=Dom, 1=Seg...
  const diff = day === 0 ? -6 : 1 - day; // volta para a segunda-feira
  const seg = new Date(d);
  seg.setDate(d.getDate() + diff);
  return seg.toISOString().slice(0, 10); // ex: "2026-05-04"
}

const SEQUENCIAS = [
  { label: 'Sequência 1', min: 1200, max: 1212 },
  { label: 'Sequência 2', min: 1213, max: 9999 },
];

function nearestNeighbor(partners: any[]): any[] {
  if (partners.length <= 1) return partners;
  const sorted = [...partners].sort((a, b) => (a.sequencia ?? Infinity) - (b.sequencia ?? Infinity));
  const withCoords = sorted.filter(p => p.lat && p.lng);
  const withoutCoords = sorted.filter(p => !p.lat || !p.lng);
  if (withCoords.length < 2) return sorted;
  const route = [withCoords[0]];
  const remaining = [...withCoords.slice(1)];
  while (remaining.length > 0) {
    const last = route[route.length - 1];
    let nearestIdx = 0, nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dlat = remaining[i].lat - last.lat;
      const dlng = remaining[i].lng - last.lng;
      const d = dlat * dlat + dlng * dlng;
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    route.push(remaining.splice(nearestIdx, 1)[0]);
  }
  return [...route, ...withoutCoords];
}

type TipoVisita = 'FISICO' | 'TELEFONE' | 'WHATSAPP';

interface VisitaModalState {
  parceiro: any;
  tipo: TipoVisita;
  comprou: boolean;
  valor: string;
  obs: string;
}

interface EditModalState {
  parceiro: any;
  nome_fantasia: string;
  cod_parceiro: string;
  regiao: string;
  sequencia: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  perfil: string;
  tabela_preco: string;
  telefone: string;
  obs_comercial: string;
  obs_loja: string;
}

export default function ParceirosClient({ parceiros, metricas, regioes, campanhas, tabelas = [], cidades = [] }: {
  parceiros: any[];
  metricas: any;
  regioes: string[];
  campanhas: any[];
  tabelas?: string[];
  cidades?: string[];
}) {
  const [localParceiros, setLocalParceiros] = useState<any[]>(parceiros);
  const [busca, setBusca] = useState('');
  const [filtroRegiao, setFiltroRegiao] = useState('');
  const [selectedParceiro, setSelectedParceiro] = useState<any | null>(null);
  const [historicoVisitas, setHistoricoVisitas] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [activeTab, setActiveTab] = useState<'todos' | number>('todos');
  const [rotasPorTab, setRotasPorTab] = useState<Record<string, { organizada: boolean; ordem: any[] }>>({});
  const tabKey = String(activeTab);
  const rotaOrganizada = rotasPorTab[tabKey]?.organizada ?? false;
  const ordemRota = rotasPorTab[tabKey]?.ordem ?? [];
  const [visitadosIds, setVisitadosIds] = useState<Set<number>>(new Set());
  const [visitaModal, setVisitaModal] = useState<VisitaModalState | null>(null);

  // Carrega visitados da semana atual do localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { semana, ids } = JSON.parse(raw);
        if (semana === getMondayStr()) {
          setVisitadosIds(new Set(ids as number[]));
        }
      }
    } catch {}
  }, []);

  // Persiste visitados no localStorage sempre que mudar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        semana: getMondayStr(),
        ids: [...visitadosIds],
      }));
    } catch {}
  }, [visitadosIds]);
  const [salvandoVisita, setSalvandoVisita] = useState(false);
  const [editModal, setEditModal] = useState<EditModalState | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const abrirEditModal = (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditModal({
      parceiro: p,
      nome_fantasia: p.nome_fantasia || '',
      cod_parceiro: p.cod_parceiro != null ? String(p.cod_parceiro) : '',
      regiao: p.regiao || '',
      sequencia: p.sequencia != null ? String(p.sequencia) : '',
      endereco: p.endereco || '',
      numero: p.numero || '',
      bairro: p.bairro || '',
      cidade: p.cidade || '',
      perfil: p.perfil || '',
      tabela_preco: p.tabela_preco || '',
      telefone: p.telefone || '',
      obs_comercial: p.obs_comercial || '',
      obs_loja: p.obs_loja || '',
    });
  };

  const salvarEdicao = async () => {
    if (!editModal) return;
    setSalvandoEdicao(true);
    const res = await atualizarParceiro(editModal.parceiro.id, {
      nome_fantasia: editModal.nome_fantasia,
      cod_parceiro: editModal.cod_parceiro ? parseInt(editModal.cod_parceiro) : null,
      regiao: editModal.regiao,
      sequencia: editModal.sequencia ? parseInt(editModal.sequencia) : null,
      endereco: editModal.endereco,
      numero: editModal.numero,
      bairro: editModal.bairro,
      cidade: editModal.cidade,
      perfil: editModal.perfil,
      tabela_preco: editModal.tabela_preco,
      telefone: editModal.telefone,
      obs_comercial: editModal.obs_comercial,
      obs_loja: editModal.obs_loja,
    });
    if (res.success) {
      const codFinal = editModal.parceiro.cod_parceiro ?? (editModal.cod_parceiro ? parseInt(editModal.cod_parceiro) : null);
      const updated = {
        ...editModal.parceiro,
        nome_fantasia: editModal.nome_fantasia,
        cod_parceiro: codFinal,
        regiao: editModal.regiao || null,
        sequencia: editModal.sequencia ? parseInt(editModal.sequencia) : null,
        endereco: editModal.endereco || null,
        numero: editModal.numero || null,
        bairro: editModal.bairro || null,
        cidade: editModal.cidade || null,
        perfil: editModal.perfil || null,
        tabela_preco: editModal.tabela_preco || null,
        telefone: editModal.telefone || null,
        obs_comercial: editModal.obs_comercial || null,
        obs_loja: editModal.obs_loja || null,
      };
      setLocalParceiros(prev => prev.map(lp => lp.id === updated.id ? updated : lp));
      if (selectedParceiro?.id === updated.id) setSelectedParceiro(updated);
      setEditModal(null);
    } else {
      alert('Erro ao salvar: ' + res.error);
    }
    setSalvandoEdicao(false);
  };

  const parcFiltrados = useMemo(() => {
    return localParceiros.filter(p => {
      if (busca && !p.nome_fantasia.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroRegiao && p.regiao !== filtroRegiao) return false;
      return true;
    });
  }, [localParceiros, busca, filtroRegiao]);

  const parceirosVisiveis = useMemo(() => {
    if (typeof activeTab !== 'number') return parcFiltrados;
    const seq = SEQUENCIAS[activeTab];
    return parcFiltrados.filter(p => { const r = Number(p.regiao); return !isNaN(r) && r >= seq.min && r <= seq.max; });
  }, [parcFiltrados, activeTab]);

  const listaMostrada = useMemo(() => {
    const base = rotaOrganizada ? ordemRota : parceirosVisiveis;
    return base.filter(p => !visitadosIds.has(p.id));
  }, [rotaOrganizada, ordemRota, parceirosVisiveis, visitadosIds]);

  const handleTabChange = (tab: 'todos' | number) => {
    setActiveTab(tab);
  };

  const handleOrganizarRota = () => {
    setRotasPorTab(prev => ({
      ...prev,
      [tabKey]: { organizada: true, ordem: nearestNeighbor(parceirosVisiveis.filter(p => !visitadosIds.has(p.id))) },
    }));
  };

  const handleDesfazerRota = () => {
    setRotasPorTab(prev => ({ ...prev, [tabKey]: { organizada: false, ordem: [] } }));
  };

  const abrirVisitaModal = (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setVisitaModal({ parceiro: p, tipo: 'FISICO', comprou: false, valor: '', obs: '' });
  };

  const confirmarVisita = async () => {
    if (!visitaModal) return;
    setSalvandoVisita(true);
    const valorNum = visitaModal.comprou && visitaModal.valor
      ? parseFloat(visitaModal.valor.replace(',', '.'))
      : undefined;
    const res = await registrarVisita({
      parceiro_id: visitaModal.parceiro.id,
      tipo_visita: visitaModal.tipo,
      comprou: visitaModal.comprou,
      valor_pedido: valorNum && !isNaN(valorNum) ? valorNum : undefined,
      observacao: visitaModal.obs || undefined,
    });
    if (res.success) {
      setVisitadosIds(prev => new Set([...prev, visitaModal.parceiro.id]));
      setVisitaModal(null);
    } else {
      alert('Erro ao registrar visita.');
    }
    setSalvandoVisita(false);
  };

  const abrirDossie = async (p: any) => {
    setSelectedParceiro(p);
    setLoadingHistorico(true);
    try {
      const hist = await buscarHistoricoVisitas(p.id);
      setHistoricoVisitas(hist);
    } catch { setHistoricoVisitas([]); }
    setLoadingHistorico(false);
  };

  const indicadorCor = (dias: number | null) => {
    if (dias === null || dias === undefined) return 'bg-slate-600';
    if (dias <= 7) return 'bg-emerald-500';
    if (dias <= 15) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const indicadorTexto = (dias: number | null) => {
    if (dias === null || dias === undefined) return 'Nunca visitado';
    if (dias === 0) return 'Visitado hoje';
    return `Há ${dias}d`;
  };

  const visitadosHoje = visitadosIds.size;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 md:p-6 space-y-6 font-sans">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/" className="text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
              Carteira de Parceiros
            </h1>
          </div>
          <p className="text-[var(--muted-foreground)] text-sm md:text-base pl-8">Gestão de visitas e recorrência</p>
        </div>
        <Link href="/" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-[var(--primary)] text-[var(--primary)] px-4 py-2 rounded-full font-bold hover:bg-[var(--primary)] hover:text-black transition-all text-sm">
          <Users className="w-4 h-4" /> Painel de Leads
        </Link>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard icon={<Users />} title="Parceiros Ativos" value={metricas.total_ativos} />
        <MetricCard icon={<Eye className="text-cyan-400" />} title="Visitados (Mês)" value={metricas.visitados_mes} />
        <MetricCard icon={<ShoppingCart className="text-emerald-400" />} title="Compraram (Mês)" value={metricas.compraram_mes} />
        <MetricCard icon={<AlertCircle className="text-rose-400" />} title="Sem Visita +15d" value={metricas.sem_visita_15d} />
      </div>

      {/* Campanhas Ativas */}
      {campanhas.length > 0 && (
        <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
          {campanhas.map((c: any) => (
            <div key={c.id} className={`flex-shrink-0 glass-panel rounded-xl p-4 border min-w-[220px] ${
              c.dias_restantes <= c.dias_antecedencia && c.dias_restantes >= 0
                ? 'border-amber-500/50 bg-amber-500/5'
                : 'border-[var(--border)]'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {c.dias_restantes > 0 ? `${c.dias_restantes}d restantes` : c.dias_restantes === 0 ? 'HOJE!' : 'Encerrada'}
                </span>
              </div>
              <h3 className="font-bold text-sm">{c.nome}</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {c.total_abordados || 0} abordados • {c.total_compraram || 0} compraram
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text" placeholder="Buscar parceiro..."
            value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-cyan-400 transition-colors"
          />
        </div>
        <select
          value={filtroRegiao} onChange={e => setFiltroRegiao(e.target.value)}
          className="bg-[var(--background)] border border-[var(--border)] rounded-full px-4 py-2 text-sm text-[var(--muted-foreground)] focus:outline-none focus:border-cyan-400"
        >
          <option value="">Todas as Regiões</option>
          {regioes.map(r => <option key={r} value={r}>Região {r}</option>)}
        </select>
      </div>

      {/* Lista de Parceiros */}
      <div className="glass-panel rounded-[var(--radius)] p-4 md:p-6">

        {/* Tabs de Sequência */}
        <div className="flex gap-0 mb-5 border-b border-[var(--border)] overflow-x-auto">
          <button
            onClick={() => handleTabChange('todos')}
            className={`px-4 py-2.5 text-sm font-bold transition-colors whitespace-nowrap border-b-2 -mb-px ${
              activeTab === 'todos'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Todos ({parcFiltrados.filter(p => !visitadosIds.has(p.id)).length})
          </button>
          {SEQUENCIAS.map((seq, i) => {
            const count = parcFiltrados.filter(p => { const r = Number(p.regiao); return !isNaN(r) && r >= seq.min && r <= seq.max && !visitadosIds.has(p.id); }).length;
            return (
              <button key={i}
                onClick={() => handleTabChange(i)}
                className={`px-4 py-2.5 text-sm font-bold transition-colors whitespace-nowrap border-b-2 -mb-px flex items-center gap-2 ${
                  activeTab === i
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                {seq.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${activeTab === i ? 'bg-cyan-400/20' : 'bg-[var(--secondary)]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Header da lista + Botão Organizar */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold">{listaMostrada.length} restantes</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {visitadosHoje > 0 && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  ✓ {visitadosHoje} visitado{visitadosHoje > 1 ? 's' : ''} hoje
                </span>
              )}
              {rotaOrganizada && (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <Navigation className="w-3 h-3" />
                  Rota otimizada — {SEQUENCIAS[activeTab as number]?.label}
                </span>
              )}
              {/* Totalizador de pendências */}
              {(() => {
                const urgente = listaMostrada.filter(p => p.dias_sem_visita === null || p.dias_sem_visita > 15).length;
                const atencao = listaMostrada.filter(p => p.dias_sem_visita !== null && p.dias_sem_visita > 7 && p.dias_sem_visita <= 15).length;
                const ok      = listaMostrada.filter(p => p.dias_sem_visita !== null && p.dias_sem_visita <= 7).length;
                return (
                  <div className="flex items-center gap-1.5">
                    {urgente > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                        {urgente} vencido{urgente > 1 ? 's' : ''}
                      </span>
                    )}
                    {atencao > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                        {atencao} atenção
                      </span>
                    )}
                    {ok > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        {ok} ok
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          {typeof activeTab === 'number' && (
            <button
              onClick={rotaOrganizada ? handleDesfazerRota : handleOrganizarRota}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                rotaOrganizada
                  ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30'
                  : 'bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20'
              }`}
            >
              <Navigation className="w-4 h-4" />
              {rotaOrganizada ? 'Desfazer Ordem' : 'Organizar Rota'}
            </button>
          )}
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {listaMostrada.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              {visitadosHoje > 0
                ? <p className="text-emerald-400 font-bold text-lg">✓ Todos visitados!</p>
                : <p className="text-[var(--muted-foreground)]">Nenhum parceiro encontrado.</p>
              }
            </div>
          ) : listaMostrada.map((p, index) => (
            <div
              key={p.id}
              className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-cyan-400/50 transition-colors cursor-pointer overflow-hidden"
              onClick={() => abrirDossie(p)}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${indicadorCor(p.dias_sem_visita)}`} />

              <div className="flex items-center gap-3 flex-1 pl-3 min-w-0">
                {rotaOrganizada && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center text-sm font-black shadow-md shadow-amber-500/30">
                    {index + 1}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base hover:text-cyan-400 transition-colors truncate">{p.nome_fantasia}</h3>
                    {p.cod_parceiro && (
                      <span className="flex-shrink-0 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        #{p.cod_parceiro}
                      </span>
                    )}
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${indicadorCor(p.dias_sem_visita)}`} title={indicadorTexto(p.dias_sem_visita)} />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {p.bairro || 'Sem Bairro'}, {p.cidade || ''}
                    {p.regiao && <span className="ml-2 px-1.5 py-0.5 bg-[var(--secondary)] rounded text-[10px] font-bold">R{p.regiao}</span>}
                  </p>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {p.perfil && <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-medium">{p.perfil}</span>}
                    <span className="text-[10px] text-[var(--muted-foreground)]">{indicadorTexto(p.dias_sem_visita)}</span>
                    {p.compras_mes > 0 && <span className="text-[10px] text-emerald-400">✓ {p.compras_mes} compra(s) no mês</span>}
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap justify-end" onClick={e => e.stopPropagation()}>
                <button
                  onClick={e => abrirEditModal(p, e)}
                  className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:border-cyan-400 hover:text-cyan-400 transition-all"
                  title="Editar parceiro"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {(() => {
                  const wazeUrl = p.lat && p.lng
                    ? `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`
                    : p.endereco
                      ? `https://waze.com/ul?q=${encodeURIComponent([p.endereco, p.numero, p.bairro, p.cidade].filter(Boolean).join(', '))}&navigate=yes`
                      : null;
                  return wazeUrl ? (
                    <a href={wazeUrl} target="_blank" rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all"
                      title="Abrir no Waze">
                      🗺️ Waze
                    </a>
                  ) : null;
                })()}
                <button
                  onClick={e => abrirVisitaModal(p, e)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-all font-black"
                >
                  👋 Registrar Visita
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Registro de Visita */}
      {visitaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--card)] w-full max-w-sm rounded-2xl border border-[var(--border)] shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-cyan-400 leading-tight">{visitaModal.parceiro.nome_fantasia}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-[var(--muted-foreground)]">Registrar visita</p>
                  {visitaModal.parceiro.cod_parceiro && (
                    <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      #{visitaModal.parceiro.cod_parceiro}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setVisitaModal(null)} className="p-1 hover:bg-[var(--muted)] rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tipo */}
            <div>
              <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Tipo de contato</p>
              <div className="flex gap-2">
                {([
                  { tipo: 'FISICO' as TipoVisita, icon: '🚶', label: 'Física' },
                  { tipo: 'TELEFONE' as TipoVisita, icon: '📞', label: 'Ligação' },
                  { tipo: 'WHATSAPP' as TipoVisita, icon: '💬', label: 'WhatsApp' },
                ]).map(v => (
                  <button key={v.tipo}
                    onClick={() => setVisitaModal(m => m ? { ...m, tipo: v.tipo } : m)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      visitaModal.tipo === v.tipo
                        ? 'bg-cyan-500 text-black'
                        : 'border border-[var(--border)] text-[var(--muted-foreground)] hover:border-cyan-400 hover:text-cyan-400'
                    }`}
                  >
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comprou? */}
            <div>
              <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Comprou?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setVisitaModal(m => m ? { ...m, comprou: false, valor: '' } : m)}
                  className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                    !visitaModal.comprou
                      ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400'
                      : 'border border-[var(--border)] text-[var(--muted-foreground)] hover:border-rose-400'
                  }`}
                >
                  ✗  Não comprou
                </button>
                <button
                  onClick={() => setVisitaModal(m => m ? { ...m, comprou: true } : m)}
                  className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                    visitaModal.comprou
                      ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                      : 'border border-[var(--border)] text-[var(--muted-foreground)] hover:border-emerald-400'
                  }`}
                >
                  ✓  Comprou!
                </button>
              </div>
            </div>

            {/* Valor (só se comprou) */}
            {visitaModal.comprou && (
              <div>
                <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Valor do pedido</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-400">R$</span>
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="0,00"
                    value={visitaModal.valor}
                    onChange={e => setVisitaModal(m => m ? { ...m, valor: e.target.value } : m)}
                    className="w-full bg-[var(--background)] border-2 border-emerald-500/50 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-emerald-400 outline-none font-bold"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Nota */}
            <input
              type="text"
              placeholder="Nota da visita (opcional)..."
              value={visitaModal.obs}
              onChange={e => setVisitaModal(m => m ? { ...m, obs: e.target.value } : m)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus:border-cyan-400 outline-none"
            />

            {/* Botões */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setVisitaModal(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold border border-[var(--border)] text-[var(--muted-foreground)] hover:border-white hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarVisita}
                disabled={salvandoVisita}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-cyan-500 text-black hover:bg-cyan-400 transition-all disabled:opacity-50"
              >
                {salvandoVisita ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--card)] w-full max-w-md rounded-2xl border border-[var(--border)] shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-cyan-400">Editar Parceiro</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{editModal.parceiro.nome_fantasia}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="p-1 hover:bg-[var(--muted)] rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Código — editável só se ainda não tem */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Cód. Parceiro {editModal.parceiro.cod_parceiro && <span className="text-amber-400 normal-case font-normal">(fixo)</span>}
                  </label>
                  <input type="number" value={editModal.cod_parceiro}
                    onChange={e => setEditModal(m => m ? { ...m, cod_parceiro: e.target.value } : m)}
                    disabled={!!editModal.parceiro.cod_parceiro}
                    className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                    placeholder="Código"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Telefone</label>
                  <input type="text" value={editModal.telefone}
                    onChange={e => setEditModal(m => m ? { ...m, telefone: e.target.value } : m)}
                    className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Nome Fantasia</label>
                <input type="text" value={editModal.nome_fantasia}
                  onChange={e => setEditModal(m => m ? { ...m, nome_fantasia: e.target.value } : m)}
                  className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Região</label>
                  <select value={editModal.regiao}
                    onChange={e => setEditModal(m => m ? { ...m, regiao: e.target.value } : m)}
                    className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none"
                  >
                    <option value="">Sem região</option>
                    {regioes.map(r => <option key={r} value={r}>Região {r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Sequência</label>
                  <input type="number" min="1" value={editModal.sequencia}
                    onChange={e => setEditModal(m => m ? { ...m, sequencia: e.target.value } : m)}
                    className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none"
                    placeholder="Ordem"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Rua / Endereço</label>
                  <input type="text" value={editModal.endereco}
                    onChange={e => setEditModal(m => m ? { ...m, endereco: e.target.value } : m)}
                    className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none"
                    placeholder="Nome da rua"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Número</label>
                  <input type="text" value={editModal.numero}
                    onChange={e => setEditModal(m => m ? { ...m, numero: e.target.value } : m)}
                    className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none"
                    placeholder="Nº"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Bairro</label>
                  <input type="text" value={editModal.bairro}
                    onChange={e => setEditModal(m => m ? { ...m, bairro: e.target.value } : m)}
                    className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Cidade</label>
                  <input list="lista-cidades" value={editModal.cidade}
                    onChange={e => setEditModal(m => m ? { ...m, cidade: e.target.value } : m)}
                    className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none"
                    placeholder="Selecione ou digite"
                  />
                  <datalist id="lista-cidades">
                    {cidades.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Tabela de Preço</label>
                <select value={editModal.tabela_preco}
                  onChange={e => setEditModal(m => m ? { ...m, tabela_preco: e.target.value } : m)}
                  className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none"
                >
                  <option value="">Sem tabela</option>
                  {tabelas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Mix / Obs. Loja</label>
                <textarea value={editModal.obs_loja} rows={2}
                  onChange={e => setEditModal(m => m ? { ...m, obs_loja: e.target.value } : m)}
                  className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none resize-none"
                  placeholder="Mix de produtos, algo a ficar de olho..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Obs. Comercial</label>
                <textarea value={editModal.obs_comercial} rows={2}
                  onChange={e => setEditModal(m => m ? { ...m, obs_comercial: e.target.value } : m)}
                  className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none resize-none"
                  placeholder="Observações comerciais..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold border border-[var(--border)] text-[var(--muted-foreground)] hover:border-white hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button onClick={salvarEdicao} disabled={salvandoEdicao}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-cyan-500 text-black hover:bg-cyan-400 transition-all disabled:opacity-50"
              >
                {salvandoEdicao ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dossiê Modal */}
      {selectedParceiro && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card)] w-full max-w-2xl rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-start bg-[var(--secondary)]/30">
              <div>
                <h2 className="text-xl font-bold text-cyan-400">{selectedParceiro.nome_fantasia}</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  {selectedParceiro.razao_social || ''} • Cód: {selectedParceiro.cod_parceiro || '?'}
                  {selectedParceiro.regiao && <span className="ml-2 px-1.5 py-0.5 bg-[var(--secondary)] rounded font-bold">R{selectedParceiro.regiao}</span>}
                </p>
              </div>
              <button onClick={() => setSelectedParceiro(null)} className="p-2 hover:bg-[var(--muted)] rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* Info do Parceiro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Dados</h3>
                  <p className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-cyan-400" /> {selectedParceiro.cnpj || 'Sem CNPJ'}</p>
                  <p className="text-sm flex items-center gap-2"><Phone className="w-4 h-4 text-cyan-400" /> {selectedParceiro.telefone || 'Sem Telefone'}</p>
                  <p className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-cyan-400" /> {selectedParceiro.endereco}{selectedParceiro.numero ? `, ${selectedParceiro.numero}` : ''} - {selectedParceiro.bairro}</p>
                  <p className="text-sm flex items-center gap-2"><Share2 className="w-4 h-4 text-cyan-400" /> {selectedParceiro.perfil || 'Sem Perfil'}</p>
                  <p className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-cyan-400" /> {selectedParceiro.tabela_preco || 'Sem Tabela'}</p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Recorrência</h3>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${indicadorCor(selectedParceiro.dias_sem_visita)}`} />
                    <span className="text-sm font-bold">{indicadorTexto(selectedParceiro.dias_sem_visita)}</span>
                  </div>
                  <p className="text-sm">{selectedParceiro.visitas_mes || 0} visitas no mês</p>
                  <p className="text-sm">{selectedParceiro.compras_mes || 0} compras no mês</p>
                  {selectedParceiro.ultima_compra && (
                    <p className="text-sm text-emerald-400">Última compra: {new Date(selectedParceiro.ultima_compra).toLocaleDateString('pt-BR')}</p>
                  )}
                  {selectedParceiro.recebe_sabado && (
                    <p className="text-xs text-[var(--muted-foreground)]">Recebe Sábado: {selectedParceiro.recebe_sabado}</p>
                  )}
                </div>
              </div>

              {selectedParceiro.obs_comercial && (
                <div className="bg-[var(--muted)]/30 p-3 rounded-xl border border-[var(--border)]">
                  <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">Observações Comerciais</h3>
                  <p className="text-sm whitespace-pre-wrap">{selectedParceiro.obs_comercial}</p>
                </div>
              )}

              {/* Waze */}
              {(() => {
                const wazeUrl = selectedParceiro.lat && selectedParceiro.lng
                  ? `https://waze.com/ul?ll=${selectedParceiro.lat},${selectedParceiro.lng}&navigate=yes`
                  : selectedParceiro.endereco
                    ? `https://waze.com/ul?q=${encodeURIComponent([selectedParceiro.endereco, selectedParceiro.numero, selectedParceiro.bairro, selectedParceiro.cidade].filter(Boolean).join(', '))}&navigate=yes`
                    : null;
                return wazeUrl ? (
                  <a href={wazeUrl} target="_blank" rel="noreferrer"
                    className="inline-block text-xs bg-cyan-500 text-black px-4 py-2 rounded-lg font-bold hover:opacity-80 transition-opacity">
                    🗺️ Abrir no Waze
                  </a>
                ) : null;
              })()}

              {/* Histórico de Visitas */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Histórico de Visitas</h3>
                {loadingHistorico ? (
                  <p className="text-sm text-[var(--muted-foreground)]">Carregando...</p>
                ) : historicoVisitas.length === 0 ? (
                  <p className="text-sm italic text-[var(--muted-foreground)]">Nenhuma visita registrada ainda.</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {historicoVisitas.map((v: any) => (
                      <div key={v.id} className="flex items-start gap-3 border-l-2 border-[var(--border)] pl-3 py-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold">{new Date(v.data_visita).toLocaleDateString('pt-BR')}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              v.tipo_visita === 'FISICO' ? 'bg-cyan-500/20 text-cyan-400' :
                              v.tipo_visita === 'TELEFONE' ? 'bg-violet-500/20 text-violet-400' :
                              'bg-emerald-500/20 text-emerald-400'
                            }`}>{v.tipo_visita}</span>
                            {v.comprou && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">COMPROU ✓</span>}
                            {v.valor_pedido && <span className="text-[10px] text-emerald-400 font-bold">R$ {Number(v.valor_pedido).toFixed(2)}</span>}
                          </div>
                          {v.observacao && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{v.observacao}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-xl p-4 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-1">
        <div className="[&>svg]:w-4 [&>svg]:h-4 text-cyan-400">{icon}</div>
        <h3 className="font-bold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">{title}</h3>
      </div>
      <p className="text-2xl md:text-3xl font-bold">{value}</p>
    </div>
  );
}
