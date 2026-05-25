'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Users, AlertCircle, MapPin, X, Phone, Search, Eye, Share2, DollarSign, FileText, ChevronLeft, Calendar, ShoppingCart, Navigation, Pencil, RotateCcw, CheckCircle, Route, Target } from 'lucide-react';
import { registrarVisita, buscarHistoricoVisitas, atualizarParceiro, toggleAtivoParceiro, marcarParceiroNaCampanha, buscarParticipantesCampanha, buscarRankingRecorrencia, cancelarVisita, registrarDevolucao, buscarLeadsPorBairro, desfazerVisitaParceiro, adicionarParceiroCampanha, removerParceiroDaCampanha } from '../actions/parceiros';
import { agendarRevisita } from '../actions';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MapaRota = dynamic(() => import('./MapaRota'), { ssr: false });


// Retorna a semana do mês (1-5) considerando segunda como início da semana.
// Ex: maio/2026 começa numa sexta → dias 1-3 = semana 1, dias 4-10 = semana 2,
//     dias 11-17 = semana 3, dias 18-24 = semana 4.
function getSemanaDoMes(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  // Offset em dias desde a última segunda (segunda=0 ... domingo=6)
  const firstDayWeekday = (firstDay.getDay() + 6) % 7;
  return Math.floor((date.getDate() + firstDayWeekday - 1) / 7) + 1;
}

const SEQUENCIAS = [
  { label: 'Sequência 1', min: 1200, max: 1212 },
  { label: 'Sequência 2', min: 1213, max: 9999 },
];

async function otimizarRotaORS(
  parceiros: any[],
  startLat: number,
  startLng: number,
  apiKey: string
): Promise<any[]> {
  const comCoords = parceiros.filter(p => p.lat && p.lng);
  const semCoords = parceiros.filter(p => !p.lat || !p.lng);
  if (comCoords.length === 0) return parceiros;

  const jobs = comCoords.map((p, i) => ({
    id: i + 1,
    location: [Number(p.lng), Number(p.lat)], // ORS usa [lng, lat]
  }));

  const res = await fetch('https://api.openrouteservice.org/optimization', {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobs,
      vehicles: [{ id: 1, profile: 'driving-car', start: [startLng, startLat] }],
    }),
  });

  if (!res.ok) throw new Error(`ORS ${res.status}`);
  const data = await res.json();
  const steps = (data.routes?.[0]?.steps ?? []).filter((s: any) => s.type === 'job');
  const ordenados = steps.map((s: any) => comCoords[s.id - 1]);
  return [...ordenados, ...semCoords];
}

function organizarRota(partners: any[], startLat?: number, startLng?: number): any[] {
  if (partners.length <= 1) return partners;

  // Ordena pela sequência cadastrada (já é a ordem geográfica real)
  const sorted = [...partners].sort((a, b) => (a.sequencia ?? Infinity) - (b.sequencia ?? Infinity));

  // Sem GPS: retorna na ordem da sequência
  if (startLat === undefined || startLng === undefined) return sorted;

  // Com GPS: encontra o parceiro com coords mais próximo e rotaciona a lista a partir dele
  const comCoords = sorted.filter(p => p.lat && p.lng);
  if (comCoords.length === 0) return sorted;

  let maisProximo = comCoords[0];
  let menorDist = Infinity;
  comCoords.forEach(p => {
    const d = (Number(p.lat) - startLat) ** 2 + (Number(p.lng) - startLng) ** 2;
    if (d < menorDist) { menorDist = d; maisProximo = p; }
  });

  const startIdx = sorted.findIndex(p => p.id === maisProximo.id);
  if (startIdx <= 0) return sorted;

  // Rotaciona: começa do mais próximo e continua na ordem da sequência
  return [...sorted.slice(startIdx), ...sorted.slice(0, startIdx)];
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
  const [localMetricas, setLocalMetricas] = useState(metricas);
  const [busca, setBusca] = useState('');
  const [filtroRegiao, setFiltroRegiao] = useState('');
  const [filtroAtrasado] = useState(false);
  const [selectedParceiro, setSelectedParceiro] = useState<any | null>(null);
  const [historicoVisitas, setHistoricoVisitas] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [activeTab, setActiveTab] = useState<'todos' | number>('todos');
  const [rotasPorTab, setRotasPorTab] = useState<Record<string, { organizada: boolean; ordem: any[] }>>(() => {
    if (typeof window !== 'undefined') {
      try { const s = sessionStorage.getItem('crm_rotasPorTab'); if (s) return JSON.parse(s); } catch {}
    }
    return {};
  });
  const tabKey = String(activeTab);
  const rotaOrganizada = rotasPorTab[tabKey]?.organizada ?? false;
  const ordemRota = rotasPorTab[tabKey]?.ordem ?? [];
  const [visitaModal, setVisitaModal] = useState<VisitaModalState | null>(null);

  const foiVisitadoSemana = (p: any) => p.visitado_esta_semana === true;

  const [salvandoVisita, setSalvandoVisita] = useState(false);
  const [notaDossie, setNotaDossie] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [editModal, setEditModal] = useState<EditModalState | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [rankingModal, setRankingModal] = useState(false);
  const [rankingAba, setRankingAba] = useState<'mes' | 'recorrencia'>('mes');
  const [rankingRecorrencia, setRankingRecorrencia] = useState<any[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [semComprasModal, setSemComprasModal] = useState(false);
  const [campanhaModal, setCampanhaModal] = useState<any | null>(null);
  const [buscaCampanha, setBuscaCampanha] = useState('');
  const [abaCampanhaModal, setAbaCampanhaModal] = useState<'participantes' | 'adicionar'>('participantes');
  const [campanhaParticipantes, setCampanhaParticipantes] = useState<Record<number, { abordado: boolean; comprou: boolean }>>({});
  const [salvandoCampanha, setSalvandoCampanha] = useState<number | null>(null);
  const [organizandoRota, setOrganizandoRota] = useState(false);
  const [mapaAberto, setMapaAberto] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [leadsProximos, setLeadsProximos] = useState<any[]>([]);
  const [agendandoLeadId, setAgendandoLeadId] = useState<number | null>(null);

  // Undo da última visita registrada
  const [ultimaVisita, setUltimaVisita] = useState<{ visitaId: number; parceiro: any; comprou: boolean; valorNum?: number } | null>(null);
  const [desfazendoVisita, setDesfazendoVisita] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpa o timer ao desmontar
  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  useEffect(() => {
    try { sessionStorage.setItem('crm_rotasPorTab', JSON.stringify(rotasPorTab)); } catch {}
  }, [rotasPorTab]);

  // Mini-perfil do lead próximo
  const [leadModal, setLeadModal] = useState<any | null>(null);
  const [agendandoLeadHoje, setAgendandoLeadHoje] = useState(false);

  // Modal de devolução
  const [devolucaoModal, setDevolucaoModal] = useState<{ visita: any; parceiro: any } | null>(null);
  const [devolucaoForm, setDevolucaoForm] = useState({ valor: '', data: '', motivo: '' });
  const [salvandoDevolucao, setSalvandoDevolucao] = useState(false);

  const abrirDevolucaoModal = (visita: any, parceiro: any) => {
    setDevolucaoModal({ visita, parceiro });
    setDevolucaoForm({
      valor: visita.valor_pedido ? String(Number(visita.valor_pedido).toFixed(2)).replace('.', ',') : '',
      data: new Date().toISOString().split('T')[0],
      motivo: '',
    });
  };

  const confirmarDevolucao = async () => {
    if (!devolucaoModal) return;
    setSalvandoDevolucao(true);
    const valorNum = devolucaoForm.valor ? parseFloat(devolucaoForm.valor.replace(',', '.')) : null;
    const res = await registrarDevolucao(devolucaoModal.visita.id, {
      valor_devolvido: valorNum && !isNaN(valorNum) ? valorNum : null,
      data_devolucao: devolucaoForm.data,
      motivo_devolucao: devolucaoForm.motivo || null,
    });
    if (res.success) {
      setHistoricoVisitas(prev => prev.map(v =>
        v.id === devolucaoModal.visita.id
          ? { ...v, status: 'devolvido', valor_devolvido: valorNum, data_devolucao: devolucaoForm.data, motivo_devolucao: devolucaoForm.motivo }
          : v
      ));
      setDevolucaoModal(null);
    } else {
      alert('Erro ao registrar devolução.');
    }
    setSalvandoDevolucao(false);
  };

  const abrirRankingModal = async () => {
    setRankingModal(true);
    setRankingAba('mes');
    setLoadingRanking(true);
    try {
      const rows = await buscarRankingRecorrencia();
      setRankingRecorrencia(rows);
    } catch { setRankingRecorrencia([]); }
    setLoadingRanking(false);
  };

  const abrirCampanhaModal = async (c: any) => {
    setCampanhaModal(c);
    setCampanhaParticipantes({});
    setBuscaCampanha('');
    setAbaCampanhaModal('participantes');
    const rows = await buscarParticipantesCampanha(c.id);
    const map: Record<number, { abordado: boolean; comprou: boolean }> = {};
    rows.forEach((r: any) => { map[r.parceiro_id] = { abordado: r.abordado, comprou: r.comprou }; });
    setCampanhaParticipantes(map);
  };

  const toggleCampanhaParceiro = async (parceiroId: number, campo: 'abordado' | 'comprou') => {
    if (!campanhaModal) return;
    setSalvandoCampanha(parceiroId);
    const atual = campanhaParticipantes[parceiroId] || { abordado: false, comprou: false };
    const novoComprou = campo === 'comprou' ? !atual.comprou : atual.comprou;
    const novoAbordado = campo === 'abordado' ? !atual.abordado : (novoComprou ? true : atual.abordado);
    await marcarParceiroNaCampanha(campanhaModal.id, parceiroId, novoComprou);
    setCampanhaParticipantes(prev => ({ ...prev, [parceiroId]: { abordado: novoAbordado, comprou: novoComprou } }));
    setSalvandoCampanha(null);
  };

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
      if (busca) {
        const q = busca.toLowerCase();
        const match = [
          p.nome_fantasia,
          p.cidade,
          p.bairro,
          p.telefone,
          p.cod_parceiro != null ? String(p.cod_parceiro) : null,
          p.sequencia != null ? String(p.sequencia) : null,
          p.regiao != null ? String(p.regiao) : null,
        ].some(v => v && String(v).toLowerCase().includes(q));
        if (!match) return false;
      }
      if (filtroRegiao && p.regiao !== filtroRegiao) return false;
      if (filtroAtrasado && !(p.dias_sem_visita === null || p.dias_sem_visita > 15)) return false;
      return true;
    });
  }, [localParceiros, busca, filtroRegiao, filtroAtrasado]);

  const parceirosVisiveis = useMemo(() => {
    if (typeof activeTab !== 'number') return parcFiltrados;
    const seq = SEQUENCIAS[activeTab];
    return parcFiltrados.filter(p => { const r = Number(p.regiao); return !isNaN(r) && r >= seq.min && r <= seq.max; });
  }, [parcFiltrados, activeTab]);

  const listaMostrada = useMemo(() => {
    // Com busca ativa: mostra todos os resultados para localizar pelo código
    if (busca) {
      if (activeTab === 'todos') return parcFiltrados;
      return parceirosVisiveis.filter(p => !foiVisitadoSemana(p));
    }

    if (activeTab === 'todos') {
      // Aba Todos: visão geral — não-visitados primeiro, visitados no final (sem ocultar)
      const naoVisitados = parcFiltrados.filter(p => !foiVisitadoSemana(p));
      const visitados = parcFiltrados.filter(p => foiVisitadoSemana(p));
      return [...naoVisitados, ...visitados];
    }

    // Abas de Sequência: oculta quem já foi visitado essa semana
    const pendentes = parceirosVisiveis.filter(p => !foiVisitadoSemana(p));

    if (!rotaOrganizada) return pendentes;

    // Rota organizada: usa dados frescos de localParceiros (ordemRota é snapshot antigo)
    const localById = new Map(localParceiros.map(p => [p.id, p]));
    const naRota = ordemRota
      .map((p: any) => localById.get(p.id) ?? p)
      .filter((p: any) => !foiVisitadoSemana(p));
    const idsNaRota = new Set(naRota.map((p: any) => p.id));
    const foraRota = pendentes.filter(p => !idsNaRota.has(p.id));
    return [...naRota, ...foraRota];
  }, [rotaOrganizada, ordemRota, parceirosVisiveis, activeTab, parcFiltrados, busca, localParceiros]);

  const handleTabChange = (tab: 'todos' | number) => {
    setActiveTab(tab);
  };

  const handleOrganizarRota = () => {
    const pendentes = parceirosVisiveis.filter(p => !foiVisitadoSemana(p));
    const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;

    const aplicarLocal = (lat?: number, lng?: number) => {
      setRotasPorTab(prev => ({
        ...prev,
        [tabKey]: { organizada: true, ordem: organizarRota(pendentes, lat, lng) },
      }));
      setOrganizandoRota(false);
    };

    const aplicarComGPS = async (lat: number, lng: number) => {
      setUserPos({ lat, lng });
      if (apiKey) {
        try {
          const ordem = await otimizarRotaORS(pendentes, lat, lng, apiKey);
          setRotasPorTab(prev => ({ ...prev, [tabKey]: { organizada: true, ordem } }));
          setOrganizandoRota(false);
          return;
        } catch {
          // fallback para algoritmo local
        }
      }
      aplicarLocal(lat, lng);
    };

    setOrganizandoRota(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => aplicarComGPS(pos.coords.latitude, pos.coords.longitude),
        () => aplicarLocal(),
        { timeout: 6000, maximumAge: 30000 }
      );
    } else {
      aplicarLocal();
    }
  };

  const handleDesfazerRota = () => {
    setRotasPorTab(prev => ({ ...prev, [tabKey]: { organizada: false, ordem: [] } }));
  };

  const moverNaRota = (idx: number, direcao: 'up' | 'down') => {
    const novaLista = [...listaMostrada];
    const swapIdx = direcao === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= novaLista.length) return;
    [novaLista[idx], novaLista[swapIdx]] = [novaLista[swapIdx], novaLista[idx]];
    setRotasPorTab(prev => ({ ...prev, [tabKey]: { organizada: true, ordem: novaLista } }));
  };

  const abrirVisitaModal = async (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setVisitaModal({ parceiro: p, tipo: 'FISICO', comprou: false, valor: '', obs: '' });
    setLeadsProximos([]);
    // Busca leads próximos se há bairro ou cidade
    if (p.bairro || p.cidade) {
      const res = await buscarLeadsPorBairro(p.cidade || null, p.bairro || null);
      if (res.success) setLeadsProximos(res.data || []);
    }
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
      const semanaHoje = getSemanaDoMes(new Date());
      const eraPrimeiraVisitaMes = !visitaModal.parceiro.visitas_mes || visitaModal.parceiro.visitas_mes === 0;
      // Salva o parceiro e visitaId para poder desfazer
      const parceiroSnapshot = { ...visitaModal.parceiro };
      setLocalParceiros(prev => prev.map(lp => {
        if (lp.id !== visitaModal.parceiro.id) return lp;
        const semanas = new Set<number>(lp.semanas_visitadas || []);
        semanas.add(semanaHoje);
        return {
          ...lp,
          semanas_visitadas: [...semanas],
          dias_sem_visita: 0,
          visitado_esta_semana: true,
          visitas_mes: (lp.visitas_mes || 0) + 1,
          compras_mes: visitaModal.comprou ? (lp.compras_mes || 0) + 1 : lp.compras_mes,
          ultima_visita: new Date().toISOString(),
        };
      }));
      setLocalMetricas((prev: any) => ({
        ...prev,
        visitados_mes: eraPrimeiraVisitaMes ? Number(prev.visitados_mes) + 1 : Number(prev.visitados_mes),
        compraram_mes: visitaModal.comprou ? Number(prev.compraram_mes) + 1 : Number(prev.compraram_mes),
        sem_visita_15d: eraPrimeiraVisitaMes ? Math.max(0, Number(prev.sem_visita_15d) - 1) : Number(prev.sem_visita_15d),
      }));
      setVisitaModal(null);
      // Ativa o toast de desfazer (15s)
      if (res.visitaId) {
        setUltimaVisita({ visitaId: res.visitaId, parceiro: parceiroSnapshot, comprou: visitaModal.comprou, valorNum });
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => setUltimaVisita(null), 15000);
      }
    } else {
      alert('Erro ao registrar visita.');
    }
    setSalvandoVisita(false);
  };

  const handleDesfazerVisita = async () => {
    if (!ultimaVisita) return;
    setDesfazendoVisita(true);
    const res = await desfazerVisitaParceiro(ultimaVisita.visitaId, ultimaVisita.parceiro.id, ultimaVisita.comprou);
    if (res.success) {
      // Reverte o estado local
      setLocalParceiros(prev => prev.map(lp =>
        lp.id === ultimaVisita.parceiro.id ? ultimaVisita.parceiro : lp
      ));
      setLocalMetricas((prev: any) => ({
        ...prev,
        visitados_mes: Math.max(0, Number(prev.visitados_mes) - (ultimaVisita.parceiro.visitas_mes === 0 ? 1 : 0)),
        compraram_mes: ultimaVisita.comprou ? Math.max(0, Number(prev.compraram_mes) - 1) : Number(prev.compraram_mes),
      }));
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUltimaVisita(null);
    } else {
      alert('Erro ao desfazer visita: ' + res.error);
    }
    setDesfazendoVisita(false);
  };

  const handleCancelarVisita = async (visitaId: number, status: 'cancelado' | 'devolvido') => {
    const acao = status === 'cancelado' ? 'cancelar' : 'marcar como devolução';
    if (!confirm(`Confirmar ${acao} este pedido? Ele sairá das métricas de compras.`)) return;
    const res = await cancelarVisita(visitaId, status);
    if (res.success) {
      setHistoricoVisitas(prev => prev.map(v => v.id === visitaId ? { ...v, status } : v));
    }
  };

  const abrirDossie = async (p: any) => {
    setSelectedParceiro(p);
    setNotaDossie(p.obs_comercial || '');
    setLoadingHistorico(true);
    try {
      const hist = await buscarHistoricoVisitas(p.id);
      setHistoricoVisitas(hist);
    } catch { setHistoricoVisitas([]); }
    setLoadingHistorico(false);
  };

  const hoje = new Date();
  const semanaAtual = getSemanaDoMes(hoje);
  const totalSemanas = Math.ceil(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate() / 7);

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

  const visitadosHoje = localParceiros.filter(foiVisitadoSemana).length;

  const semComprasParceiros = useMemo(() =>
    localParceiros
      .filter(p => !p.compras_mes || p.compras_mes === 0)
      .sort((a, b) => {
        if (!a.ultima_compra && !b.ultima_compra) return 0;
        if (!a.ultima_compra) return -1;
        if (!b.ultima_compra) return 1;
        return new Date(a.ultima_compra).getTime() - new Date(b.ultima_compra).getTime();
      }),
    [localParceiros]
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 md:p-6 space-y-6 font-sans">
      {/* ── Header ── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 md:p-6 border-b border-[var(--border)] bg-[rgba(9,12,11,0.8)] backdrop-blur-xl sticky top-0 z-50 -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-[var(--primary)] flex items-center gap-2">
            <Link href="/" className="text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            Carteira de Parceiros
          </h1>
          <p className="text-[var(--muted-foreground)] text-sm md:text-base font-medium pl-8">Gestão de visitas e recorrência</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-[var(--primary)] text-[var(--primary)] px-4 py-2 rounded-full font-bold hover:bg-[var(--primary)] hover:text-black transition-all text-sm shadow-[0_0_15px_rgba(0,230,118,0.1)]">
            <Users className="w-4 h-4" /> Home
          </Link>
          <Link href="/leads" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-amber-500 text-amber-400 px-4 py-2 rounded-full font-bold hover:bg-amber-500 hover:text-black transition-all text-sm">
            <Route className="w-4 h-4" /> Leads
          </Link>
          <Link href="/campanhas" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-purple-500 text-purple-400 px-4 py-2 rounded-full font-bold hover:bg-purple-500 hover:text-black transition-all text-sm">
            <Target className="w-4 h-4" /> Campanhas
          </Link>
        </div>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
        <MetricCard icon={<Users />} title="Parceiros Ativos" value={localMetricas.total_ativos} />
        <MetricCard icon={<Eye className="text-cyan-400" />} title="Visitados (Mês)" value={localMetricas.visitados_mes} />
        <MetricCard
          icon={<ShoppingCart className="text-emerald-400" />}
          title="Compraram (Mês)"
          value={localMetricas.compraram_mes}
          subtitle={localMetricas.visitados_mes > 0 ? `${Math.round(Number(localMetricas.compraram_mes) / Number(localMetricas.visitados_mes) * 100)}% de conversão` : undefined}
          onClick={abrirRankingModal}
        />
        <MetricCard
          icon={<AlertCircle className="text-rose-400" />}
          title="Sem Compras (Mês)"
          value={semComprasParceiros.length}
          subtitle={`de ${localMetricas.total_ativos} ativos`}
          onClick={() => setSemComprasModal(true)}
        />
        <MetricCard
          icon={<DollarSign className="text-emerald-400" />}
          title="Ticket Médio (Mês)"
          value={localMetricas.ticket_medio_mes && Number(localMetricas.ticket_medio_mes) > 0 ? `R$ ${Number(localMetricas.ticket_medio_mes).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ —'}
          subtitle={localMetricas.ticket_medio_geral && Number(localMetricas.ticket_medio_geral) > 0 ? `Geral: R$ ${Number(localMetricas.ticket_medio_geral).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Registre valores nas visitas'}
        />
      </div>

      {/* Campanhas Ativas */}
      {campanhas.length > 0 && (
        <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
          {campanhas.map((c: any) => (
            <div key={c.id} onClick={() => abrirCampanhaModal(c)} className={`flex-shrink-0 glass-panel rounded-xl p-4 border min-w-[220px] cursor-pointer hover:border-amber-400/60 transition-colors ${
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
              <h3 className="font-bold text-sm">{c.nome}{c.rede ? ` · ${c.rede.replace(/TABELA\s*/i, '')}` : ''}</h3>
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
      <div className="glass-panel stagger-item rounded-[var(--radius)] p-4 md:p-6">

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
            Todos ({parcFiltrados.length})
          </button>
          {SEQUENCIAS.map((seq, i) => {
            const count = parcFiltrados.filter(p => { const r = Number(p.regiao); return !isNaN(r) && r >= seq.min && r <= seq.max && !foiVisitadoSemana(p); }).length;
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
                  ✓ {visitadosHoje} visitado{visitadosHoje > 1 ? 's' : ''} na semana
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
            <div className="flex gap-2">
              {rotaOrganizada && (
                <button
                  onClick={() => setMapaAberto(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 transition-all"
                >
                  🗺️ Ver Mapa
                </button>
              )}
              <button
                onClick={rotaOrganizada ? handleDesfazerRota : handleOrganizarRota}
                disabled={organizandoRota}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-60 ${
                  rotaOrganizada
                    ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                }`}
              >
                <Navigation className="w-4 h-4" />
                {organizandoRota ? 'Obtendo GPS...' : rotaOrganizada ? 'Desfazer Ordem' : 'Organizar Rota'}
              </button>
            </div>
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
          ) : listaMostrada.map((p, index) => {
            const foiVisitado = foiVisitadoSemana(p);
            const anteriorFoiVisitado = index > 0 && foiVisitadoSemana(listaMostrada[index - 1]);
            const primeiroDosVisitados = foiVisitado && !anteriorFoiVisitado && !busca;
            return (
            <div key={p.id}>
              {primeiroDosVisitados && (
                <div className="flex items-center gap-2 py-2 px-1">
                  <div className="flex-1 h-px bg-emerald-500/20" />
                  <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-wider whitespace-nowrap">
                    ✓ {listaMostrada.filter(x => foiVisitadoSemana(x)).length} já visitado(s)
                  </span>
                  <div className="flex-1 h-px bg-emerald-500/20" />
                </div>
              )}
            <div
              className={`relative glass-panel stagger-item border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors cursor-pointer overflow-hidden ${
                foiVisitado
                  ? 'border-emerald-500/20 opacity-60 hover:opacity-80'
                  : 'border-transparent hover:border-[var(--primary)]'
              }`}
              onClick={() => abrirDossie(p)}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${indicadorCor(p.dias_sem_visita)}`} />

              <div className="flex items-center gap-3 flex-1 pl-3 min-w-0">
                {rotaOrganizada && (
                  <div className="flex-shrink-0 flex flex-col items-center gap-0.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => moverNaRota(index, 'up')}
                      disabled={index === 0}
                      className="text-[10px] text-amber-400 hover:text-amber-300 disabled:opacity-20 disabled:cursor-not-allowed leading-none px-1"
                    >▲</button>
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center text-sm font-black shadow-md shadow-amber-500/30">
                      {index + 1}
                    </div>
                    <button
                      onClick={() => moverNaRota(index, 'down')}
                      disabled={index === listaMostrada.length - 1}
                      className="text-[10px] text-amber-400 hover:text-amber-300 disabled:opacity-20 disabled:cursor-not-allowed leading-none px-1"
                    >▼</button>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.cod_parceiro && (
                      <span className="flex-shrink-0 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        #{p.cod_parceiro}
                      </span>
                    )}
                    <h3 className="font-bold text-base hover:text-cyan-400 transition-colors truncate flex-1 min-w-0">{p.nome_fantasia}</h3>
                    {/* Mostra sequencia nas abas de sequência */}
                    {typeof activeTab === 'number' && p.sequencia && (
                      <span className="flex-shrink-0 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-300 border border-slate-500/30">
                        S{p.sequencia}
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
                    {p.ticket_medio && <span className="text-[10px] text-cyan-400 font-bold">∅ R$ {Number(p.ticket_medio).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                  </div>
                  {p.ultima_obs_visita && (
                    <p className="text-[10px] text-[var(--muted-foreground)] italic mt-1 truncate">📝 {p.ultima_obs_visita}</p>
                  )}
                  <div className="flex gap-1 mt-1.5">
                    {Array.from({ length: totalSemanas }, (_, i) => i + 1).map(s => {
                      const visitou = (p.semanas_visitadas || []).includes(s);
                      const atual = s === semanaAtual;
                      return (
                        <span key={s} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          visitou
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : atual
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                        }`}>S{s}</span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap justify-end" onClick={e => e.stopPropagation()}>
                <button
                  onClick={e => abrirEditModal(p, e)}
                  className="p-2.5 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:border-cyan-400 hover:text-cyan-400 transition-all"
                  title="Editar parceiro"
                >
                  <Pencil className="w-4 h-4" />
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
            </div>
          );
          })}
        </div>
      </div>

      {/* Modal de Registro de Visita */}
      {visitaModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-[var(--card)] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-2xl flex flex-col max-h-[92vh]">

            {/* Header fixo — sempre visível, X nunca some */}
            <div className="flex justify-between items-start p-5 pb-3 flex-shrink-0 border-b border-[var(--border)]">
              <div>
                <h3 className="font-bold text-lg text-cyan-400 leading-tight">{visitaModal.parceiro.nome_fantasia}</h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs text-[var(--muted-foreground)]">Registrar visita</p>
                  {visitaModal.parceiro.cod_parceiro && (
                    <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      #{visitaModal.parceiro.cod_parceiro}
                    </span>
                  )}
                  {/* Contadores semana + mês */}
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Sem. {(visitaModal.parceiro.semanas_visitadas || []).length}/{totalSemanas}
                  </span>
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Mês {visitaModal.parceiro.visitas_mes || 0}x
                  </span>
                </div>
              </div>
              <button onClick={() => setVisitaModal(null)} className="p-2 hover:bg-[var(--muted)] rounded-full transition-colors flex-shrink-0 ml-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo scrollável */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">

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

            {/* Leads próximos — aparece quando há leads no mesmo bairro/cidade */}
            {visitaModal.tipo === 'FISICO' && leadsProximos.length > 0 && (
              <div className="border border-amber-500/30 rounded-xl overflow-hidden">
                <div className="bg-amber-500/10 px-3 py-2 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    {leadsProximos.length} lead{leadsProximos.length > 1 ? 's' : ''} nesta área para prospectar
                  </p>
                </div>
                <div className="divide-y divide-[var(--border)] max-h-40 overflow-y-auto">
                  {leadsProximos.map(lead => (
                    <div key={lead.id} className="flex items-center justify-between px-3 py-2 gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{lead.nome_fantasia}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">
                          {lead.bairro || lead.cidade} • {lead.status}
                        </p>
                      </div>
                      <button
                        onClick={() => setLeadModal(lead)}
                        className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition-all whitespace-nowrap"
                      >
                        👁️ Ver lead
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botões — rodapé fixo, nunca some */}
            </div>
            <div className="flex gap-2 p-5 pt-3 flex-shrink-0 border-t border-[var(--border)]">
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
            <button
              onClick={async () => {
                const novoAtivo = !editModal.parceiro.ativo;
                const acao = novoAtivo ? 'ativar' : 'desativar';
                if (!confirm(`Confirmar ${acao} este parceiro?`)) return;
                const res = await toggleAtivoParceiro(editModal.parceiro.id, novoAtivo);
                if (res.success) {
                  setLocalParceiros(prev => prev.filter(lp => lp.id !== editModal.parceiro.id));
                  setLocalMetricas((prev: any) => ({
                    ...prev,
                    total_ativos: Number(prev.total_ativos) + (novoAtivo ? 1 : -1),
                  }));
                  setEditModal(null);
                }
              }}
              className={`w-full py-2 rounded-lg text-xs font-bold border transition-all mt-1 ${
                editModal.parceiro.ativo
                  ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                  : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              {editModal.parceiro.ativo ? 'Desativar Parceiro' : 'Ativar Parceiro'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de Ranking */}
      {rankingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--card)] w-full max-w-md rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-emerald-400">Ranking de Compradores</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {Number(localMetricas.compraram_mes)} compradores • {localMetricas.visitados_mes > 0 ? Math.round(Number(localMetricas.compraram_mes) / Number(localMetricas.visitados_mes) * 100) : 0}% de conversão este mês
                </p>
              </div>
              <button onClick={() => setRankingModal(false)} className="p-1 hover:bg-[var(--muted)] rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Abas */}
            <div className="flex border-b border-[var(--border)]">
              {(['mes', 'recorrencia'] as const).map(aba => (
                <button key={aba} onClick={() => setRankingAba(aba)}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors border-b-2 -mb-px ${rankingAba === aba ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-[var(--muted-foreground)]'}`}>
                  {aba === 'mes' ? '📅 Este Mês' : '🔄 Recorrência'}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
              {rankingAba === 'mes' ? (
                (() => {
                  const top = [...localParceiros]
                    .filter(p => p.compras_mes > 0)
                    .sort((a, b) => b.compras_mes - a.compras_mes)
                    .slice(0, 10);
                  const max = top[0]?.compras_mes || 1;
                  return top.length === 0
                    ? <p className="text-center text-[var(--muted-foreground)] py-8 text-sm">Nenhuma compra registrada este mês.</p>
                    : top.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--secondary)] transition-colors">
                        <span className={`text-sm font-black w-6 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-[var(--muted-foreground)]'}`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{p.nome_fantasia}</p>
                          <div className="mt-1 h-1.5 rounded-full bg-[var(--secondary)] overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(p.compras_mes / max) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-emerald-400 flex-shrink-0">{p.compras_mes}x</span>
                      </div>
                    ));
                })()
              ) : loadingRanking ? (
                <p className="text-center text-[var(--muted-foreground)] py-8 text-sm">Carregando...</p>
              ) : rankingRecorrencia.length === 0 ? (
                <p className="text-center text-[var(--muted-foreground)] py-8 text-sm">Nenhum histórico de compras.</p>
              ) : (() => {
                const max = Number(rankingRecorrencia[0]?.total_compras) || 1;
                return rankingRecorrencia.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--secondary)] transition-colors">
                    <span className={`text-sm font-black w-6 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-[var(--muted-foreground)]'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{p.nome_fantasia}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--secondary)] overflow-hidden">
                          <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(Number(p.total_compras) / max) * 100}%` }} />
                        </div>
                        {p.ticket_medio && <span className="text-[10px] text-[var(--muted-foreground)]">R${Number(p.ticket_medio).toFixed(0)}/pedido</span>}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-cyan-400 flex-shrink-0">{p.total_compras}x</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Campanha */}
      {campanhaModal && (() => {
        const participantesIds = new Set(Object.keys(campanhaParticipantes).map(Number));
        const participantes = localParceiros.filter(p => participantesIds.has(p.id));
        const naoParticipantes = localParceiros.filter(p => !participantesIds.has(p.id));
        const filtrarPorBusca = (lista: any[]) =>
          buscaCampanha
            ? lista.filter(p => (p.nome_fantasia || '').toLowerCase().includes(buscaCampanha.toLowerCase()))
            : lista;
        const listaAdicionar = filtrarPorBusca(
          campanhaModal.rede
            ? naoParticipantes.filter(p => p.tabela_preco === campanhaModal.rede)
            : naoParticipantes
        );
        const listaParticipantes = filtrarPorBusca(participantes);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[var(--card)] w-full max-w-lg rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

              {/* Header */}
              <div className="p-5 border-b border-[var(--border)] flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      {campanhaModal.dias_restantes > 0 ? `${campanhaModal.dias_restantes}d restantes` : campanhaModal.dias_restantes === 0 ? 'HOJE!' : 'Encerrada'}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg">{campanhaModal.nome}</h3>
                  {campanhaModal.rede && (
                    <p className="text-xs text-purple-400 mt-0.5 font-bold">{campanhaModal.rede}</p>
                  )}
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {participantesIds.size} participantes • {Object.values(campanhaParticipantes).filter((v: any) => v.comprou).length} compraram
                  </p>
                </div>
                <button onClick={() => setCampanhaModal(null)} className="p-1 hover:bg-[var(--muted)] rounded-full transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-4 pt-3 pb-0 border-b border-[var(--border)] flex gap-2">
                {[
                  { key: 'participantes', label: `Na Campanha (${participantesIds.size})` },
                  { key: 'adicionar', label: `+ Adicionar` },
                ].map(t => (
                  <button key={t.key}
                    onClick={() => { setAbaCampanhaModal(t.key as any); setBuscaCampanha(''); }}
                    className={`text-xs font-bold px-4 py-2 rounded-t-lg border-b-2 transition-all ${
                      abaCampanhaModal === t.key
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-[var(--muted-foreground)] hover:text-amber-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="px-4 py-2 border-b border-[var(--border)]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                  <input
                    type="text"
                    placeholder="Buscar parceiro..."
                    value={buscaCampanha}
                    onChange={e => setBuscaCampanha(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-full py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto custom-scrollbar flex-1">
                {abaCampanhaModal === 'participantes' ? (
                  listaParticipantes.length === 0 ? (
                    <div className="text-center py-10 text-[var(--muted-foreground)]">
                      <p className="font-semibold text-sm">{buscaCampanha ? 'Nenhum resultado.' : 'Nenhum parceiro na campanha ainda.'}</p>
                      {!buscaCampanha && <p className="text-xs mt-1">Use a aba "+ Adicionar" para incluir parceiros.</p>}
                    </div>
                  ) : listaParticipantes.map(p => {
                    const status = campanhaParticipantes[p.id];
                    const loading = salvandoCampanha === p.id;
                    return (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] last:border-0">
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-bold truncate">{p.nome_fantasia}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">{p.bairro} • {p.perfil || p.cidade}</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => toggleCampanhaParceiro(p.id, 'abordado')}
                            disabled={loading}
                            className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-all disabled:opacity-50 ${
                              status?.abordado
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-amber-400 hover:text-amber-400'
                            }`}
                          >
                            Abordado
                          </button>
                          <button
                            onClick={() => toggleCampanhaParceiro(p.id, 'comprou')}
                            disabled={loading}
                            className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-all disabled:opacity-50 ${
                              status?.comprou
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-emerald-400 hover:text-emerald-400'
                            }`}
                          >
                            Comprou
                          </button>
                          <button
                            onClick={async () => {
                              setSalvandoCampanha(p.id);
                              const res = await removerParceiroDaCampanha(campanhaModal.id, p.id);
                              if (res.success) {
                                setCampanhaParticipantes(prev => {
                                  const next = { ...prev };
                                  delete next[p.id];
                                  return next;
                                });
                              }
                              setSalvandoCampanha(null);
                            }}
                            disabled={loading}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-50"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  listaAdicionar.length === 0 ? (
                    <div className="text-center py-10 text-[var(--muted-foreground)]">
                      <p className="font-semibold text-sm">{buscaCampanha ? 'Nenhum resultado.' : 'Todos os parceiros desta tabela já estão na campanha.'}</p>
                    </div>
                  ) : listaAdicionar.map(p => {
                    const loading = salvandoCampanha === p.id;
                    return (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] last:border-0">
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-bold truncate">{p.nome_fantasia}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">{p.bairro} • {p.perfil || p.cidade}</p>
                        </div>
                        <button
                          onClick={async () => {
                            setSalvandoCampanha(p.id);
                            const res = await adicionarParceiroCampanha(campanhaModal.id, p.id);
                            if (res.success) {
                              setCampanhaParticipantes(prev => ({ ...prev, [p.id]: { abordado: false, comprou: false } }));
                            }
                            setSalvandoCampanha(null);
                          }}
                          disabled={loading}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-all disabled:opacity-50 flex-shrink-0"
                        >
                          {loading ? '...' : '+ Adicionar'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Sem Compras */}
      {semComprasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--card)] w-full max-w-lg rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-rose-400">Sem Compras Este Mês</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {semComprasParceiros.length} parceiro{semComprasParceiros.length !== 1 ? 's' : ''} sem nenhuma compra em {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
                </p>
              </div>
              <button onClick={() => setSemComprasModal(false)} className="p-1 hover:bg-[var(--muted)] rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar flex-1 divide-y divide-[var(--border)]">
              {semComprasParceiros.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--secondary)] transition-colors cursor-pointer" onClick={() => { setSemComprasModal(false); abrirDossie(p); }}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${indicadorCor(p.dias_sem_visita)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{p.nome_fantasia}</p>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      {p.regiao && <span className="text-[10px] bg-[var(--secondary)] px-1.5 py-0.5 rounded font-bold">R{p.regiao}</span>}
                      <span className="text-[10px] text-[var(--muted-foreground)]">{indicadorTexto(p.dias_sem_visita)}</span>
                      {p.ultima_compra
                        ? <span className="text-[10px] text-amber-400">Última compra: {new Date(p.ultima_compra).toLocaleDateString('pt-BR')}</span>
                        : <span className="text-[10px] text-rose-400 font-bold">Nunca comprou</span>
                      }
                      {p.ticket_medio && <span className="text-[10px] text-cyan-400">∅ R$ {Number(p.ticket_medio).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setSemComprasModal(false); abrirVisitaModal(p, e); }}
                    className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-all"
                  >
                    👋 Visita
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mapa da Rota */}
      {mapaAberto && (
        <MapaRota
          parceiros={listaMostrada}
          userLat={userPos?.lat}
          userLng={userPos?.lng}
          onClose={() => setMapaAberto(false)}
        />
      )}

      {/* Dossiê Modal — sempre centralizado, fecha ao clicar fora */}
      {selectedParceiro && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setSelectedParceiro(null)}
        >
          <div
            className="bg-[var(--card)] w-full max-w-2xl rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden max-h-[90vh] sm:max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle de arrastar — visível só no mobile */}
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-[var(--muted)]" />
            </div>
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-start bg-[var(--secondary)]/30 flex-shrink-0">
              <div className="flex-1 min-w-0 pr-2">
                <h2 className="text-xl font-bold text-cyan-400 truncate">{selectedParceiro.nome_fantasia}</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-1 flex items-center gap-1 flex-wrap">
                  {selectedParceiro.cod_parceiro && <span className="font-mono font-bold text-amber-400">#{selectedParceiro.cod_parceiro}</span>}
                  {selectedParceiro.cod_parceiro && <span>•</span>}
                  {selectedParceiro.razao_social || ''}
                  {selectedParceiro.regiao && <span className="ml-1 px-1.5 py-0.5 bg-[var(--secondary)] rounded font-bold">R{selectedParceiro.regiao}</span>}
                </p>
              </div>
              <button onClick={() => setSelectedParceiro(null)} className="p-3 hover:bg-[var(--muted)] rounded-full transition-colors flex-shrink-0" title="Fechar">
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
                  {selectedParceiro.ticket_medio && (
                    <p className="text-sm font-bold text-cyan-400">
                      Ticket médio: R$ {Number(selectedParceiro.ticket_medio).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  {selectedParceiro.ultima_compra && (
                    <p className="text-sm text-emerald-400">Última compra: {new Date(selectedParceiro.ultima_compra).toLocaleDateString('pt-BR')}</p>
                  )}
                  {selectedParceiro.recebe_sabado && (
                    <p className="text-xs text-[var(--muted-foreground)]">Recebe Sábado: {selectedParceiro.recebe_sabado}</p>
                  )}
                </div>
              </div>

              {/* Nota do cliente — editável inline */}
              <div className="bg-[var(--muted)]/30 p-3 rounded-xl border border-[var(--border)] space-y-2">
                <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Nota do Cliente</h3>
                <textarea
                  value={notaDossie}
                  onChange={e => setNotaDossie(e.target.value)}
                  rows={3}
                  placeholder="Escreva algo sobre este cliente..."
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none resize-none"
                />
                {notaDossie !== (selectedParceiro.obs_comercial || '') && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNotaDossie(selectedParceiro.obs_comercial || '')}
                      className="flex-1 py-2 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--muted-foreground)] hover:text-white transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={salvandoNota}
                      onClick={async () => {
                        setSalvandoNota(true);
                        const res = await atualizarParceiro(selectedParceiro.id, {
                          nome_fantasia: selectedParceiro.nome_fantasia || '',
                          cod_parceiro: selectedParceiro.cod_parceiro ?? null,
                          regiao: selectedParceiro.regiao || '',
                          sequencia: selectedParceiro.sequencia ?? null,
                          endereco: selectedParceiro.endereco || '',
                          numero: selectedParceiro.numero || '',
                          bairro: selectedParceiro.bairro || '',
                          cidade: selectedParceiro.cidade || '',
                          perfil: selectedParceiro.perfil || '',
                          tabela_preco: selectedParceiro.tabela_preco || '',
                          telefone: selectedParceiro.telefone || '',
                          obs_comercial: notaDossie,
                          obs_loja: selectedParceiro.obs_loja || '',
                        });
                        if (res.success) {
                          const updated = { ...selectedParceiro, obs_comercial: notaDossie };
                          setSelectedParceiro(updated);
                          setLocalParceiros(prev => prev.map(lp => lp.id === updated.id ? { ...lp, obs_comercial: notaDossie } : lp));
                        }
                        setSalvandoNota(false);
                      }}
                      className="flex-1 py-2 rounded-lg text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400 transition-all disabled:opacity-50"
                    >
                      {salvandoNota ? 'Salvando...' : 'Salvar Nota'}
                    </button>
                  </div>
                )}
              </div>

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
                  <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar">
                    {historicoVisitas.map((v: any) => {
                      const cancelado = v.status === 'cancelado';
                      const devolvido = v.status === 'devolvido';
                      return (
                        <div key={v.id} className="space-y-1">
                          {/* ── Linha da visita / pedido ── */}
                          <div className={`flex items-start gap-3 border-l-2 pl-3 py-1 ${cancelado ? 'border-rose-500/30 opacity-50' : devolvido ? 'border-amber-500/40' : 'border-[var(--border)]'}`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold ${cancelado ? 'line-through text-[var(--muted-foreground)]' : ''}`}>
                                  {new Date(v.data_visita).toLocaleDateString('pt-BR')}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  v.tipo_visita === 'FISICO' ? 'bg-cyan-500/20 text-cyan-400' :
                                  v.tipo_visita === 'TELEFONE' ? 'bg-violet-500/20 text-violet-400' :
                                  'bg-emerald-500/20 text-emerald-400'
                                }`}>{v.tipo_visita}</span>
                                {v.comprou && !cancelado && (
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">COMPROU ✓</span>
                                )}
                                {v.valor_pedido && (
                                  <span className={`text-[10px] font-bold ${cancelado ? 'line-through text-[var(--muted-foreground)]' : devolvido ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    R$ {Number(v.valor_pedido).toFixed(2)}
                                  </span>
                                )}
                                {cancelado && <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-bold">CANCELADO</span>}
                                {devolvido && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">DEVOLVIDO</span>}
                              </div>
                              {v.observacao && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{v.observacao}</p>}
                            </div>
                            {v.comprou && !cancelado && !devolvido && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleCancelarVisita(v.id, 'cancelado')}
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all"
                                  title="Cancelar pedido"
                                >✕ Cancelar</button>
                                <button
                                  onClick={() => abrirDevolucaoModal(v, selectedParceiro)}
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-all"
                                  title="Registrar devolução"
                                >↩ Devolver</button>
                              </div>
                            )}
                          </div>

                          {/* ── Linha de devolução (entrada separada) ── */}
                          {devolvido && (
                            <div className="ml-5 flex items-start gap-2 border-l-2 border-rose-500/60 pl-3 py-1.5 bg-rose-500/15 rounded-r-lg">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-bold text-rose-400">↩ Devolução</span>
                                  {v.data_devolucao && (
                                    <span className="text-[10px] text-[var(--muted-foreground)]">
                                      {new Date(v.data_devolucao).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                    </span>
                                  )}
                                  {v.valor_devolvido != null && (
                                    <span className="text-[10px] font-bold text-rose-400">
                                      R$ {Number(v.valor_devolvido).toFixed(2)}
                                      {v.valor_pedido && Number(v.valor_devolvido) < Number(v.valor_pedido) && (
                                        <span className="text-[var(--muted-foreground)] font-normal"> (parcial)</span>
                                      )}
                                    </span>
                                  )}
                                  {!v.data_devolucao && v.valor_devolvido == null && !v.motivo_devolucao && (
                                    <button
                                      onClick={() => abrirDevolucaoModal(v, selectedParceiro)}
                                      className="text-[10px] font-bold px-2 py-0.5 rounded border border-rose-500/40 text-rose-400 hover:bg-rose-500/20 transition-all"
                                    >↩ Registrar detalhes</button>
                                  )}
                                </div>
                                {v.motivo_devolucao && (
                                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5 italic">"{v.motivo_devolucao}"</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {/* Bot\u00e3o fechar fixo no rodap\u00e9 \u2014 facilita fechar no mobile */}
            <div className="flex-shrink-0 p-4 border-t border-[var(--border)] sm:hidden">
              <button
                onClick={() => setSelectedParceiro(null)}
                className="w-full py-3 rounded-xl text-sm font-bold border border-[var(--border)] text-[var(--muted-foreground)] hover:text-white hover:border-white transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini-perfil do Lead Pr\u00f3ximo */}
      {leadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--card)] w-full max-w-sm rounded-2xl border border-amber-500/40 shadow-2xl shadow-amber-900/30 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-4 flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">📍 Lead próximo</span>
                <h3 className="font-bold text-base mt-0.5 leading-tight">{leadModal.nome_fantasia}</h3>
              </div>
              <button onClick={() => setLeadModal(null)} className="p-1 hover:bg-[var(--muted)] rounded-full transition-colors mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info */}
            <div className="px-5 py-4 space-y-2.5">
              {/* Status + prioridade */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  leadModal.status === 'Em Andamento' ? 'bg-amber-500/20 text-amber-400' :
                  leadModal.status === 'Cliente' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>{leadModal.status}</span>
                {leadModal.prioridade && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    leadModal.prioridade === 'ALTA' ? 'bg-rose-500/20 text-rose-400' :
                    leadModal.prioridade === 'MEDIA' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>{leadModal.prioridade}</span>
                )}
              </div>

              {/* Localização */}
              {(leadModal.endereco || leadModal.bairro || leadModal.cidade) && (
                <p className="text-sm text-[var(--muted-foreground)] flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>{[leadModal.endereco, leadModal.bairro, leadModal.cidade].filter(Boolean).join(' — ')}</span>
                </p>
              )}

              {/* Telefone */}
              {leadModal.telefone && (
                <a href={`tel:${leadModal.telefone}`} className="text-sm flex items-center gap-2 text-[var(--primary)] hover:underline">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  {leadModal.telefone}
                </a>
              )}

              {leadModal.nome_contato && (
                <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                  {leadModal.nome_contato}
                </p>
              )}
            </div>

            {/* Ações */}
            <div className="px-5 pb-5 flex flex-col gap-2">
              <button
                onClick={async () => {
                  setAgendandoLeadHoje(true);
                  const hoje = new Date().toISOString().split('T')[0];
                  await agendarRevisita(leadModal.id, hoje);
                  setAgendandoLeadHoje(false);
                  // Remove da lista de próximos
                  setLeadsProximos(prev => prev.filter(l => l.id !== leadModal.id));
                  setLeadModal(null);
                }}
                disabled={agendandoLeadHoje}
                className="w-full py-3 rounded-xl text-sm font-bold bg-amber-500 text-black hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                {agendandoLeadHoje ? 'Adicionando...' : 'Adicionar à rota de hoje'}
              </button>
              <button
                onClick={() => setLeadModal(null)}
                className="w-full py-2.5 rounded-xl text-sm font-bold border border-[var(--border)] text-[var(--muted-foreground)] hover:border-white hover:text-white transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Devolução ─────────────────────────────────────── */}
      {devolucaoModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card)] w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-rose-500/40 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-rose-500/20 bg-rose-500/5 flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">↩ Registrar Devolução</p>
                <h2 className="text-base font-bold leading-tight">{devolucaoModal.parceiro?.nome_fantasia}</h2>
                {devolucaoModal.visita.valor_pedido && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Pedido original: <span className="text-emerald-400 font-bold">R$ {Number(devolucaoModal.visita.valor_pedido).toFixed(2)}</span>
                    {' · '}{new Date(devolucaoModal.visita.data_visita).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <button onClick={() => setDevolucaoModal(null)} className="p-1 hover:bg-[var(--muted)] rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Valor devolvido</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={devolucaoForm.valor}
                    onChange={e => setDevolucaoForm(f => ({ ...f, valor: e.target.value }))}
                    placeholder="Ex: 150,00"
                    className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-rose-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Data da devolução</label>
                  <input
                    type="date"
                    value={devolucaoForm.data}
                    onChange={e => setDevolucaoForm(f => ({ ...f, data: e.target.value }))}
                    className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-rose-400 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Motivo <span className="normal-case font-normal text-[var(--muted-foreground)]">(obrigatório)</span></label>
                <textarea
                  value={devolucaoForm.motivo}
                  onChange={e => setDevolucaoForm(f => ({ ...f, motivo: e.target.value }))}
                  placeholder="Ex: Produto com defeito, pedido errado, cliente desistiu..."
                  rows={3}
                  className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-rose-400 outline-none resize-none"
                />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setDevolucaoModal(null)} className="flex-1 py-3 rounded-xl text-sm font-bold border border-[var(--border)] text-[var(--muted-foreground)] hover:border-white hover:text-white transition-all">
                Cancelar
              </button>
              <button
                onClick={confirmarDevolucao}
                disabled={salvandoDevolucao || !devolucaoForm.motivo.trim() || !devolucaoForm.data}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {salvandoDevolucao ? 'Salvando...' : '↩ Confirmar Devolução'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de desfazer visita registrada */}
      {ultimaVisita && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-cyan-950 border border-cyan-500/50 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-cyan-900/50">
            <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-cyan-400 truncate">Visita registrada!</p>
              <p className="text-xs text-cyan-600 truncate">{ultimaVisita.parceiro.nome_fantasia}</p>
            </div>
            <button
              onClick={handleDesfazerVisita}
              disabled={desfazendoVisita}
              className="flex-shrink-0 flex items-center gap-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {desfazendoVisita ? '...' : 'Desfazer'}
            </button>
            <button
              onClick={() => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); setUltimaVisita(null); }}
              className="p-1 text-cyan-600 hover:text-cyan-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, onClick, active, subtitle }: { title: string; value: string | number; icon: React.ReactNode; onClick?: () => void; active?: boolean; subtitle?: string }) {
  return (
    <div
      className={`glass-panel ag-card stagger-item rounded-xl p-4 relative overflow-hidden transition-colors ${onClick ? 'cursor-pointer hover:border-emerald-400/30' : ''} ${active ? 'border border-rose-500/60 bg-rose-500/5' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="[&>svg]:w-4 [&>svg]:h-4 text-cyan-400">{icon}</div>
        <h3 className="font-bold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">{title}{active && <span className="ml-1 text-rose-400">●</span>}</h3>
      </div>
      <p className="text-2xl md:text-3xl font-bold">{value}</p>
      {subtitle && <p className="text-[10px] text-emerald-400 font-bold mt-1">{subtitle}</p>}
    </div>
  );
}
