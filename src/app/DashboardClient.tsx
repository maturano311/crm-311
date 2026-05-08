'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, TrendingUp, AlertCircle, MapPin, CheckCircle, RefreshCcw, X, Phone, Mail, Clock, Map as MapIcon, FileText, Search, Edit2, Save, Plus, Navigation, Share2, DollarSign, CalendarClock, Route } from 'lucide-react';
import { updateClienteStatus, marcarVisita, salvarEdicaoCliente, appendNotaAtendimento, agendarRevisita, marcarComoClienteBase } from './actions';
import { reverseGeocode, adicionarLeadManual } from './actions/radar';
import { buscarSubRedes } from './actions/tabelas';
import { converterLeadEmParceiro } from './actions/parceiros';
import Link from 'next/link';

export default function DashboardClient({ clientes, metricas, prazos = [], redes = [] }: { 
  clientes: any[], metricas: any,
  prazos: { id: number; descricao: string }[],
  redes: { id: number; nome: string }[]
}) {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('Prospectar');
  const [busca, setBusca] = useState('');
  const [subRedes, setSubRedes] = useState<{ id: number; nome: string }[]>([]);
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [notaRapida, setNotaRapida] = useState('');
  const [savingNota, setSavingNota] = useState(false);
  const [agendandoId, setAgendandoId] = useState<number | null>(null);
  const [agendandoData, setAgendandoData] = useState('');
  
  // States do Cadastro Rápido (FAB)
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [newLead, setNewLead] = useState({
    nome_fantasia: '',
    tipo: 'MERCADO',
    status: 'Não iniciada',
    tipo_entrada: 'A PROSPECTAR',
    endereco: '',
    bairro: '',
    cidade: '',
    lat: null as number | null,
    lng: null as number | null,
    jaVisitou: false
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    prazo_pagamento: '',
    observacao_atendimento: '',
    telefone: '',
    nome_contato: '',
    revisitar: '',
    cnpj: '',
    inscricao_estadual: '',
    email_xml: '',
    email_financeiro: '',
    rede: '',
    sub_rede: '',
    prioridade: ''
  });

  // Atualiza o form sempre que o cliente for selecionado
  useEffect(() => {
    if (selectedCliente) {
      setEditForm({
        prazo_pagamento: selectedCliente.prazo_pagamento || '',
        observacao_atendimento: selectedCliente.observacao_atendimento || '',
        telefone: selectedCliente.telefone || '',
        nome_contato: selectedCliente.nome_contato || '',
        revisitar: selectedCliente.revisitar ? new Date(selectedCliente.revisitar).toISOString().split('T')[0] : '',
        cnpj: selectedCliente.cnpj || '',
        inscricao_estadual: selectedCliente.inscricao_estadual || '',
        email_xml: selectedCliente.email_xml || '',
        email_financeiro: selectedCliente.email_financeiro || '',
        rede: selectedCliente.rede || '',
        sub_rede: selectedCliente.sub_rede || '',
        prioridade: selectedCliente.prioridade || ''
      });
      setIsEditing(false);
      setNotaRapida('');
    }
  }, [selectedCliente]);

  // Carrega sub_redes ao entrar em modo de edição se o cliente já tem rede
  useEffect(() => {
    if (isEditing && editForm.rede) {
      const rede = redes.find(r => r.nome === editForm.rede);
      if (rede) {
        buscarSubRedes(rede.id).then(sub => setSubRedes(sub));
      }
    }
  }, [isEditing]);

  // Carrega sub_redes quando rede é selecionada
  const handleRedeChange = async (redeNome: string) => {
    setEditForm(f => ({ ...f, rede: redeNome, sub_rede: '' }));
    const rede = redes.find(r => r.nome === redeNome);
    if (rede) {
      const sub = await buscarSubRedes(rede.id);
      setSubRedes(sub);
    } else {
      setSubRedes([]);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    setLoadingId(id);
    await updateClienteStatus(id, newStatus);
    setLoadingId(null);

    // Se acabou de fechar o cliente, converte em parceiro e abre o Airtable
    if (newStatus === 'Cliente') {
      // Converter lead em parceiro automaticamente
      await converterLeadEmParceiro(id);

      const cliente = clientes.find(c => c.id === id);
      if (cliente) {
        const url = new URL('https://airtable.com/appJfkS4V90ZR31Gd/pag2NohdvoypNSgjc/form');
        url.searchParams.append('prefill_TIPO', 'CADASTRO');
        if (cliente.nome_fantasia) url.searchParams.append('prefill_NOME FANTASIA', cliente.nome_fantasia);
        if (cliente.cnpj) url.searchParams.append('prefill_CNPJ', cliente.cnpj);
        if (cliente.inscricao_estadual) url.searchParams.append('prefill_INSCRIÇÃO ESTADUAL', cliente.inscricao_estadual);
        if (cliente.email_xml) url.searchParams.append('prefill_EMAIL XML', cliente.email_xml);
        if (cliente.email_financeiro) url.searchParams.append('prefill_EMAIL FINANCEIRO', cliente.email_financeiro);
        if (cliente.telefone) url.searchParams.append('prefill_TELEFONE', cliente.telefone);
        if (cliente.rede) url.searchParams.append('prefill_REDE', cliente.rede);
        if (cliente.sub_rede) url.searchParams.append('prefill_REDES E SUB REDES', cliente.sub_rede);
        if (cliente.prazo_pagamento) url.searchParams.append('prefill_PRAZO', cliente.prazo_pagamento);
        if (cliente.observacao_atendimento) url.searchParams.append('prefill_OBSERVAÇÕES', cliente.observacao_atendimento);

        window.open(url.toString(), '_blank');
      }
    }
  };

  const handleMarcarVisita = async (id: number) => {
    setLoadingId(id);
    await marcarVisita(id);
    setLoadingId(null);
  };

  const handleSalvarEdicao = async () => {
    if (!selectedCliente) return;
    setLoadingId(selectedCliente.id);
    
    const res = await salvarEdicaoCliente(selectedCliente.id, editForm);
    if (res.success) {
      setSelectedCliente({ ...selectedCliente, ...editForm });
      setIsEditing(false);
    } else {
      alert('Erro ao salvar as informações.');
    }
    setLoadingId(null);
  };

  const handleSalvarNotaRapida = async () => {
    if (!selectedCliente || !notaRapida.trim()) return;
    setSavingNota(true);
    const hoje = new Date().toLocaleDateString('pt-BR');
    const novaLinha = `[${hoje}] ${notaRapida.trim()}`;
    const notaAnterior = selectedCliente.observacao_atendimento;
    const notaFinal = notaAnterior ? `${notaAnterior}\n${novaLinha}` : novaLinha;

    const res = await appendNotaAtendimento(selectedCliente.id, notaFinal);
    if (res.success) {
      setSelectedCliente({ ...selectedCliente, observacao_atendimento: notaFinal });
      setNotaRapida('');
    } else {
      alert('Erro ao salvar a nota.');
    }
    setSavingNota(false);
  };

  const handleAgendarRapido = async (id: number, data: string) => {
    setLoadingId(id);
    const res = await agendarRevisita(id, data);
    if (res.success) {
      setAgendandoId(null);
      setAgendandoData('');
    } else {
      alert('Erro ao agendar.');
    }
    setLoadingId(null);
  };

  const handleClienteBase = async (id: number) => {
    if (!confirm('Este cliente já comprava de você? Ele será marcado como Cliente e não contará nas estatísticas de conversão das prospecções.')) return;
    setLoadingId(id);
    const res = await marcarComoClienteBase(id);
    if (res.success) {
      setBusca('');
    } else {
      alert('Erro ao atualizar cliente.');
    }
    setLoadingId(null);
  };

  // Gera data futura em ISO (YYYY-MM-DD)
  const dataFutura = (dias: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
  };

  const labelData = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  const handlePegarLocalizacao = () => {
    if (!navigator.geolocation) {
      alert('Seu navegador não suporta geolocalização.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      const res = await reverseGeocode(lat, lng);
      if (res.success && res.data) {
        setNewLead(prev => ({
          ...prev,
          lat, lng,
          endereco: res.data.endereco,
          bairro: res.data.bairro,
          cidade: res.data.cidade
        }));
      } else {
        alert(res.error || 'Erro ao converter coordenadas no Google.');
      }
      setIsLocating(false);
    }, (error) => {
      alert('Erro ao acessar o GPS: ' + error.message);
      setIsLocating(false);
    });
  };

  const handleSalvarNovoLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingId(-1); // Usando -1 como id de carregamento global para o form
    
    const leadParaSalvar = {
      ...newLead,
      status: newLead.jaVisitou ? 'Em Andamento' : 'Não iniciada',
      tipo_entrada: newLead.jaVisitou ? 'JA PROSPECTADO' : 'A PROSPECTAR'
    };

    const res = await adicionarLeadManual(leadParaSalvar);
    if (res.success) {
      setIsAddingNew(false);
      setNewLead({
        nome_fantasia: '', tipo: 'MERCADO', status: 'Não iniciada', tipo_entrada: 'A PROSPECTAR',
        endereco: '', bairro: '', cidade: '', lat: null, lng: null, jaVisitou: false
      });
    } else {
      alert(res.error || 'Erro ao adicionar o lead.');
    }
    setLoadingId(null);
  };

  // Lista filtrada (memoizada para evitar dupla execução e melhorar performance mobile)
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      const matchesBusca = busca ? c.nome_fantasia.toLowerCase().includes(busca.toLowerCase()) : true;
      if (!matchesBusca) return false;
      if (filtroPrioridade === 'SEM') { if (c.prioridade != null && c.prioridade !== '') return false; }
      else if (filtroPrioridade && c.prioridade !== filtroPrioridade) return false;
      if (filtroCidade && c.cidade !== filtroCidade) return false;

      if (activeTab === 'Prospectar') return c.status === 'Não iniciada';
      if (activeTab === 'Andamento') return c.status === 'Em Andamento';
      if (activeTab === 'Rota') return c.revisitar != null && c.status !== 'Descartado' && c.status !== 'Cliente';
      if (activeTab === 'Convertidos') return c.status === 'Cliente' && c.tipo_entrada !== 'CLIENTE_BASE';
      if (activeTab === 'Descartados') return c.status === 'Descartado';
      if (activeTab === 'Todos') return true;
      return true;
    });
  }, [clientes, busca, filtroPrioridade, filtroCidade, activeTab]);

  // Cidades disponíveis na aba atual (sem levar em conta filtro de cidade, para não "sumir" opções)
  const cidadesDisponiveis = useMemo(() => {
    return [...new Set(
      clientes
        .filter(c => {
          if (activeTab === 'Prospectar') return c.status === 'Não iniciada';
          if (activeTab === 'Andamento') return c.status === 'Em Andamento';
          return true;
        })
        .map(c => c.cidade)
        .filter(Boolean)
    )].sort();
  }, [clientes, activeTab]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 md:p-6 space-y-8 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-emerald-400">
            311 Representações
          </h1>
          <p className="text-[var(--muted-foreground)] text-sm md:text-base">Visão Operacional de Rua</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/parceiros" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-cyan-500 text-cyan-400 px-4 py-2 rounded-full font-bold hover:bg-cyan-500 hover:text-black transition-all">
            <Users className="w-4 h-4" /> Parceiros
          </Link>
          <Link href="/rota" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-amber-500 text-amber-400 px-4 py-2 rounded-full font-bold hover:bg-amber-500 hover:text-black transition-all">
            <Route className="w-4 h-4" /> Minha Rota
          </Link>
          <Link href="/relatorios" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-violet-500 text-violet-400 px-4 py-2 rounded-full font-bold hover:bg-violet-500 hover:text-black transition-all">
            <TrendingUp className="w-4 h-4" /> Relatórios
          </Link>
          <Link href="/radar" className="magnetic-button flex items-center gap-2 bg-[var(--card)] border border-[var(--primary)] text-[var(--primary)] px-4 py-2 rounded-full font-bold hover:bg-[var(--primary)] hover:text-black transition-all">
            <Search className="w-4 h-4" /> Radar de Leads
          </Link>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <MetricCard icon={<Users />} title="Total de Leads" value={clientes.length.toString()} />
        <MetricCard icon={<CheckCircle className="text-emerald-400" />} title="Convertidos" value={clientes.filter(c => c.status === 'Cliente' && c.tipo_entrada !== 'CLIENTE_BASE').length.toString()} />
        <MetricCard icon={<Clock className="text-amber-400" />} title="Em Andamento" value={clientes.filter(c => c.status === 'Em Andamento').length.toString()} className="col-span-2 md:col-span-1" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main List */}
        <div className="lg:col-span-2 glass-panel rounded-[var(--radius)] p-4 md:p-6 flex flex-col h-[70vh]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h2 className="text-xl font-bold">Base de Leads</h2>
            
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input 
                type="text"
                placeholder="Buscar por nome..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>
            
            <button onClick={() => window.location.reload()} className="text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors self-end md:self-auto hidden md:block">
              <RefreshCcw className="w-5 h-5" />
            </button>
          </div>

          {/* Abas Táticas */}
          <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-hide border-b border-[var(--border)]">
            {[
              { id: 'Prospectar', label: 'A Prospectar' },
              { id: 'Andamento', label: 'Em Andamento' },
              { id: 'Rota', label: 'Rota de Visitas' },
              { id: 'Convertidos', label: 'Convertidos' },
              { id: 'Descartados', label: 'Descartados' },
              { id: 'Todos', label: 'Ver Todos' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === tab.id ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filtros de Prioridade e Cidade — visíveis em Prospectar e Andamento */}
          {(activeTab === 'Prospectar' || activeTab === 'Andamento') && (
            <div className="flex flex-wrap gap-2 mb-3">
              {/* Prioridade */}
              <div className="flex gap-1 flex-wrap">
                {[{ v: '', l: 'Todas' }, { v: 'ALTA', l: 'ALTA' }, { v: 'MEDIA', l: 'MEDIA' }, { v: 'BAIXA', l: 'BAIXA' }, { v: 'SEM', l: 'Sem Prior.' }].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setFiltroPrioridade(v)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                      filtroPrioridade === v
                        ? v === 'ALTA' ? 'bg-rose-500 text-white border-rose-500'
                          : v === 'MEDIA' ? 'bg-amber-500 text-black border-amber-500'
                          : v === 'BAIXA' ? 'bg-emerald-500 text-white border-emerald-500'
                          : v === 'SEM' ? 'bg-slate-600 text-white border-slate-600'
                          : 'bg-[var(--primary)] text-black border-[var(--primary)]'
                        : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {/* Cidade */}
              <select
                value={filtroCidade}
                onChange={e => setFiltroCidade(e.target.value)}
                className="bg-[var(--background)] border border-[var(--border)] rounded-full px-3 py-1 text-xs text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] ml-auto"
              >
                <option value="">Todas as Cidades</option>
                {cidadesDisponiveis.map(cidade => (
                  <option key={cidade} value={cidade}>{cidade}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 custom-scrollbar">
            {clientesFiltrados.length === 0 ? (
              <p className="text-center text-[var(--muted-foreground)] py-8">Nenhum cliente encontrado nessa visão.</p>
            ) : (
              clientesFiltrados.map(cliente => (
                <div key={cliente.id} className="relative bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-[var(--primary)]/50 transition-colors overflow-hidden">
                  
                  {/* Cor Lateral Magnética */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${cliente.prioridade === 'ALTA' ? 'bg-rose-500' : cliente.prioridade === 'BAIXA' ? 'bg-emerald-500' : 'bg-amber-500'}`} />

                  <div className="flex-1 cursor-pointer pl-3" onClick={() => setSelectedCliente(cliente)}>
                    <h3 className="font-bold text-lg hover:text-[var(--primary)] transition-colors">{cliente.nome_fantasia}</h3>
                    <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {cliente.bairro || 'Sem Bairro'}, {cliente.cidade || 'Sem Cidade'}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-[var(--secondary)] text-[var(--secondary-foreground)] px-2 py-1 rounded-full font-medium">
                        {cliente.status}
                      </span>
                      {cliente.revisitar && (
                        <span className="text-xs border border-[var(--border)] text-[var(--muted-foreground)] px-2 py-1 rounded-full font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3"/> {new Date(cliente.revisitar).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {cliente.status === 'Em Andamento' && (
                      <button onClick={() => handleStatusChange(cliente.id, 'Cliente')} disabled={loadingId === cliente.id} className="magnetic-button bg-[var(--primary)] text-black px-4 py-2 rounded-[var(--radius-sm)] text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                        Fechou
                      </button>
                    )}
                    {cliente.tipo_entrada === 'A PROSPECTAR' && (
                      <button onClick={() => handleMarcarVisita(cliente.id)} disabled={loadingId === cliente.id} className="magnetic-button border border-[var(--border)] bg-transparent px-4 py-2 rounded-[var(--radius-sm)] text-sm font-bold hover:bg-[var(--secondary)] disabled:opacity-50">
                        Visitou
                      </button>
                    )}
                    {cliente.tipo_entrada !== 'CLIENTE_BASE' && (
                      <button onClick={() => handleClienteBase(cliente.id)} disabled={loadingId === cliente.id} className="magnetic-button border border-[var(--border)] text-[var(--muted-foreground)] bg-transparent px-4 py-2 rounded-[var(--radius-sm)] text-sm font-bold hover:bg-[var(--border)] disabled:opacity-50" title="Marcar como cliente antigo (não conta como conversão)">
                        Já era cliente
                      </button>
                    )}
                    {/* Botão Agendar Visita rápido */}
                    <button
                      onClick={() => { setAgendandoId(agendandoId === cliente.id ? null : cliente.id); setAgendandoData(''); }}
                      className={`magnetic-button border px-4 py-2 rounded-[var(--radius-sm)] text-sm font-bold transition-colors ${
                        agendandoId === cliente.id
                          ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                          : 'border-[var(--border)] bg-transparent hover:border-amber-500 hover:text-amber-400'
                      }`}
                    >
                      📅 Agendar
                    </button>
                  </div>

                  {/* Mini-picker de agendamento rápido */}
                  {agendandoId === cliente.id && (
                    <div className="mt-3 pt-3 border-t border-[var(--border)]/50 space-y-2 animate-in slide-in-from-top-1 duration-150">
                      <p className="text-xs text-[var(--muted-foreground)] font-bold uppercase tracking-wider">Quando voltar?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: 'Amanhã', dias: 1 },
                          { label: '+3d', dias: 3 },
                          { label: '+1 sem', dias: 7 },
                          { label: '+15d', dias: 15 },
                          { label: '+1 mês', dias: 30 },
                        ].map(({ label, dias }) => {
                          const val = dataFutura(dias);
                          return (
                            <button
                              key={label}
                              onClick={() => setAgendandoData(val)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                agendandoData === val
                                  ? 'bg-amber-500 text-black border-amber-500'
                                  : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-amber-500 hover:text-amber-400'
                              }`}
                            >
                              {label} <span className="opacity-60 font-normal">({labelData(val)})</span>
                            </button>
                          );
                        })}
                      </div>
                      {/* Date picker manual + confirmar */}
                      <div className="flex gap-2 items-center">
                        <input
                          type="date"
                          value={agendandoData}
                          onChange={e => setAgendandoData(e.target.value)}
                          className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs focus:border-amber-500 outline-none"
                        />
                        <button
                          onClick={() => agendandoData && handleAgendarRapido(cliente.id, agendandoData)}
                          disabled={!agendandoData || loadingId === cliente.id}
                          className="px-4 py-1.5 bg-amber-500 text-black rounded-lg text-xs font-bold hover:bg-amber-400 disabled:opacity-40 transition-colors whitespace-nowrap"
                        >
                          {loadingId === cliente.id ? '...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Dossiê Modal (Aparece ao clicar em um cliente) */}
      {selectedCliente && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card)] w-full max-w-2xl rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-start bg-[var(--secondary)]/30">
              <div>
                <h2 className="text-2xl font-bold text-[var(--primary)]">{selectedCliente.nome_fantasia}</h2>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">{selectedCliente.cnpj || 'CNPJ não informado'} • {selectedCliente.tipo || 'Tipo não definido'}</p>
              </div>
              <button onClick={() => setSelectedCliente(null)} className="p-2 hover:bg-[var(--muted)] rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="flex items-center justify-between mb-2">
                {/* Prioridade — editável no cabeçalho */}
                {isEditing ? (
                  <div className="flex gap-1">
                    {['ALTA', 'MEDIA', 'BAIXA'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEditForm({...editForm, prioridade: p})}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                          editForm.prioridade === p
                            ? p === 'ALTA' ? 'bg-rose-500 text-white border-rose-500'
                              : p === 'MEDIA' ? 'bg-amber-500 text-black border-amber-500'
                              : 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    selectedCliente.prioridade === 'ALTA' ? 'bg-rose-500/20 text-rose-400'
                    : selectedCliente.prioridade === 'MEDIA' ? 'bg-amber-500/20 text-amber-400'
                    : selectedCliente.prioridade === 'BAIXA' ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-500/20 text-slate-400'
                  }`}>{selectedCliente.prioridade || 'Sem Prior.'}</span>
                )}
                {isEditing ? (
                  <button onClick={handleSalvarEdicao} disabled={loadingId === selectedCliente.id} className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-md font-bold text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50">
                    <Save className="w-4 h-4" /> Salvar
                  </button>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 border border-[var(--primary)] text-[var(--primary)] px-4 py-2 rounded-md font-bold text-sm hover:bg-[var(--primary)] hover:text-black transition-colors">
                    <Edit2 className="w-4 h-4" /> Editar Informações
                  </button>
                )}
              </div>

              {/* Dados do Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Coluna 1: Contato e Fiscal */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Contato</h3>
                    {isEditing ? (
                      <div className="space-y-2">
                        <input type="text" placeholder="Nome do Contato" value={editForm.nome_contato} onChange={e => setEditForm({...editForm, nome_contato: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-sm focus:border-[var(--primary)] outline-none" />
                        <input type="text" placeholder="Telefone / WhatsApp" value={editForm.telefone} onChange={e => setEditForm({...editForm, telefone: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-sm focus:border-[var(--primary)] outline-none" />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-[var(--primary)]"/> {selectedCliente.nome_contato || 'Sem Contato Definido'}</p>
                        <p className="text-sm flex items-center gap-2"><Phone className="w-4 h-4 text-[var(--primary)]"/> {selectedCliente.telefone || 'Sem Telefone'}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Fiscal / ERP</h3>
                    {isEditing ? (
                      <div className="space-y-2">
                        <input type="text" placeholder="CNPJ" value={editForm.cnpj} onChange={e => setEditForm({...editForm, cnpj: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-sm focus:border-[var(--primary)] outline-none" />
                        <input type="text" placeholder="Inscrição Estadual (Ex: ISENTO)" value={editForm.inscricao_estadual} onChange={e => setEditForm({...editForm, inscricao_estadual: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-sm focus:border-[var(--primary)] outline-none" />
                        <input type="email" placeholder="E-mail XML" value={editForm.email_xml} onChange={e => setEditForm({...editForm, email_xml: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-sm focus:border-[var(--primary)] outline-none" />
                        <input type="email" placeholder="E-mail Financeiro" value={editForm.email_financeiro} onChange={e => setEditForm({...editForm, email_financeiro: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-sm focus:border-[var(--primary)] outline-none" />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-[var(--primary)]"/> {selectedCliente.cnpj || 'Sem CNPJ'}</p>
                        <p className="text-sm flex items-center gap-2"><span className="text-[var(--primary)] text-[10px] font-bold w-4 text-center">IE</span> {selectedCliente.inscricao_estadual || 'Sem Inscrição Estadual'}</p>
                        <p className="text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-[var(--primary)]"/> {selectedCliente.email_xml || 'Sem E-mail XML'}</p>
                        <p className="text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-[var(--primary)]"/> {selectedCliente.email_financeiro || 'Sem E-mail Financeiro'}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna 2: Operacional */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Operacional</h3>
                    
                    <div className="space-y-3">
                      {/* Rede e Sub Rede — vindos do banco */}
                      <div className="text-sm flex items-start gap-2">
                        <Share2 className="w-4 h-4 mt-0.5 text-[var(--primary)] flex-shrink-0"/>
                        {isEditing ? (
                          <div className="w-full space-y-2">
                            <select value={editForm.rede} onChange={e => handleRedeChange(e.target.value)} className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-sm focus:border-[var(--primary)] outline-none">
                              <option value="">Selecionar Rede</option>
                              {redes.map(r => <option key={r.id} value={r.nome}>{r.nome}</option>)}
                            </select>
                            <select value={editForm.sub_rede} onChange={e => setEditForm({...editForm, sub_rede: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-sm focus:border-[var(--primary)] outline-none" disabled={subRedes.length === 0}>
                              <option value="">Selecionar Sub Rede</option>
                              {subRedes.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span>{selectedCliente.rede || 'Sem Rede'}</span>
                            {selectedCliente.sub_rede && <span className="text-xs text-[var(--muted-foreground)]">↳ {selectedCliente.sub_rede}</span>}
                          </div>
                        )}
                      </div>

                      {/* Prazo de Pagamento — vindo do banco */}
                      <div className="text-sm flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-[var(--primary)] flex-shrink-0"/>
                        {isEditing ? (
                          <select value={editForm.prazo_pagamento} onChange={e => setEditForm({...editForm, prazo_pagamento: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-sm focus:border-[var(--primary)] outline-none">
                            <option value="">Prazo de Pagamento</option>
                            {prazos.map(p => <option key={p.id} value={p.descricao}>{p.descricao}</option>)}
                          </select>
                        ) : (
                          <span>{selectedCliente.prazo_pagamento || 'Sem Prazo'}</span>
                        )}
                      </div>
                      
                      {/* Data de Visita */}
                      <div className="text-sm flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-[var(--primary)] flex-shrink-0"/>
                        {isEditing ? (
                          <div className="w-full space-y-2">
                            {/* Atalhos rápidos de data */}
                            <div className="flex flex-wrap gap-1">
                              {[
                                { label: 'Amanhã', dias: 1 },
                                { label: '+3d', dias: 3 },
                                { label: '+1 sem', dias: 7 },
                                { label: '+15d', dias: 15 },
                                { label: '+30d', dias: 30 },
                              ].map(({ label, dias }) => {
                                const d = new Date();
                                d.setDate(d.getDate() + dias);
                                const val = d.toISOString().split('T')[0];
                                return (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={() => setEditForm({...editForm, revisitar: val})}
                                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${editForm.revisitar === val ? 'bg-[var(--primary)] text-black border-[var(--primary)]' : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]'}`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                              {editForm.revisitar && (
                                <button type="button" onClick={() => setEditForm({...editForm, revisitar: ''})} className="px-2 py-0.5 rounded text-[11px] font-bold border border-rose-500/50 text-rose-400 hover:bg-rose-500/10 transition-all">
                                  Limpar
                                </button>
                              )}
                            </div>
                            <input type="date" value={editForm.revisitar} onChange={e => setEditForm({...editForm, revisitar: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-sm focus:border-[var(--primary)] outline-none" />
                          </div>
                        ) : (
                          <span>{selectedCliente.revisitar ? `Visita em: ${new Date(selectedCliente.revisitar).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : 'Sem Visita Agendada'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rota e Observações */}
              <div className="space-y-3 bg-[var(--muted)]/30 p-4 rounded-xl border border-[var(--border)]">
                <h3 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Informações de Rota
                </h3>
                <p className="text-sm">{selectedCliente.endereco}</p>
                {selectedCliente.observacao_rota && (
                  <div className="mt-2 text-sm text-emerald-400 font-medium">
                    📍 {selectedCliente.observacao_rota}
                  </div>
                )}
                {selectedCliente.google_maps_url && (
                  <a href={selectedCliente.google_maps_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs bg-[var(--primary)] text-black px-3 py-1.5 rounded font-bold hover:opacity-80">
                    Abrir no Maps
                  </a>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Notas de Atendimento / Visita
                </h3>
                {isEditing ? (
                  <textarea 
                    value={editForm.observacao_atendimento} 
                    onChange={e => setEditForm({...editForm, observacao_atendimento: e.target.value})} 
                    placeholder="Ex: Visitei no dia 5/5 e o gerente pediu para voltar amanhã..."
                    className="w-full bg-[var(--background)] border border-[var(--primary)] rounded-md p-3 text-sm min-h-[100px] outline-none"
                  />
                ) : (
                  <>
                    <p className="text-sm italic border-l-2 border-[var(--primary)] pl-3 text-[var(--muted-foreground)] whitespace-pre-wrap">
                      {selectedCliente.observacao_atendimento ? `"${selectedCliente.observacao_atendimento}"` : "Nenhuma anotação registrada ainda."}
                    </p>
                    {/* Nota Rápida — anexa sem abrir modo de edição */}
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={notaRapida}
                        onChange={e => setNotaRapida(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSalvarNotaRapida(); }}
                        placeholder="Adicionar nota rápida... (Enter para salvar)"
                        className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:border-[var(--primary)] outline-none placeholder:text-[var(--muted-foreground)]"
                      />
                      <button
                        onClick={handleSalvarNotaRapida}
                        disabled={savingNota || !notaRapida.trim()}
                        className="px-3 py-2 bg-[var(--primary)] text-black rounded-md text-sm font-bold hover:opacity-80 disabled:opacity-40 transition-all whitespace-nowrap"
                      >
                        {savingNota ? '...' : '+ Nota'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Botão de Descartar Movido para o final */}
              <div className="pt-4 mt-2 flex justify-end">
                  {selectedCliente.status !== 'Descartado' && selectedCliente.status !== 'Cliente' && (
                    <button 
                      onClick={async () => {
                        await handleStatusChange(selectedCliente.id, 'Descartado');
                        setSelectedCliente({...selectedCliente, status: 'Descartado'});
                      }} 
                      disabled={loadingId === selectedCliente.id}
                      className="text-xs font-medium text-rose-400 hover:text-rose-500 hover:underline transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Descartar Lead
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botão Flutuante (FAB) */}
      <button 
        onClick={() => setIsAddingNew(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[var(--primary)] text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modal de Cadastro Rápido */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card)] w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--secondary)]/30">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[var(--primary)]" /> Novo Lead na Rota
              </h2>
              <button onClick={() => setIsAddingNew(false)} className="p-2 hover:bg-[var(--muted)] rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSalvarNovoLead} className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Nome Fantasia *</label>
                <input 
                  type="text" required
                  value={newLead.nome_fantasia}
                  onChange={e => setNewLead({...newLead, nome_fantasia: e.target.value})}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-md px-4 py-2 focus:border-[var(--primary)] outline-none" 
                  placeholder="Nome do estabelecimento"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Tipo de Negócio *</label>
                <select 
                  value={newLead.tipo}
                  onChange={e => setNewLead({...newLead, tipo: e.target.value})}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-md px-4 py-2 focus:border-[var(--primary)] outline-none appearance-none"
                >
                  <option value="MERCADO">MERCADO</option>
                  <option value="SUPERMERCADO">SUPERMERCADO</option>
                  <option value="PADARIA">PADARIA</option>
                  <option value="RESTAURANTE">RESTAURANTE</option>
                  <option value="MERCADINHO">MERCADINHO</option>
                  <option value="OUTROS">OUTROS</option>
                </select>
              </div>

              <div className="pt-2">
                <button 
                  type="button" 
                  onClick={handlePegarLocalizacao}
                  disabled={isLocating}
                  className="w-full flex items-center justify-center gap-2 border border-[var(--primary)] text-[var(--primary)] py-2.5 rounded-md font-bold hover:bg-[var(--primary)] hover:text-black transition-colors disabled:opacity-50"
                >
                  <Navigation className="w-4 h-4" /> 
                  {isLocating ? 'Capturando Satélites...' : 'Pegar Minha Localização Atual (GPS)'}
                </button>
                {newLead.endereco && (
                  <p className="text-xs text-emerald-400 mt-2 text-center break-words">📍 {newLead.endereco}</p>
                )}
              </div>

              <div className="flex items-center gap-3 bg-[var(--muted)]/30 p-4 rounded-lg border border-[var(--border)]">
                <input 
                  type="checkbox" 
                  id="jaVisitou"
                  checked={newLead.jaVisitou}
                  onChange={e => setNewLead({...newLead, jaVisitou: e.target.checked})}
                  className="w-5 h-5 accent-[var(--primary)]"
                />
                <label htmlFor="jaVisitou" className="text-sm font-medium cursor-pointer">
                  Já visitei e iniciei a prospecção agora
                </label>
              </div>

              <button 
                type="submit" 
                disabled={loadingId === -1 || !newLead.nome_fantasia}
                className="w-full magnetic-button bg-[var(--primary)] text-black py-3 rounded-md font-bold text-lg disabled:opacity-50 mt-4"
              >
                {loadingId === -1 ? 'Salvando...' : 'Adicionar ao CRM'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, className = "" }: { title: string, value: string | number, icon: React.ReactNode, className?: string }) {
  return (
    <div className={`glass-panel rounded-[var(--radius)] p-4 md:p-6 relative overflow-hidden group ${className}`}>
      <div className="flex items-center gap-2 md:gap-3 mb-2">
        <div className="[&>svg]:w-5 [&>svg]:h-5 md:[&>svg]:w-6 md:[&>svg]:h-6 text-[var(--primary)]">
          {icon}
        </div>
        <h3 className="font-bold text-[var(--muted-foreground)] uppercase tracking-wider text-xs md:text-sm">{title}</h3>
      </div>
      <p className="text-2xl md:text-4xl font-bold text-[var(--foreground)] mt-2">{value}</p>
    </div>
  );
}
