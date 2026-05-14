'use client';

import { useState, useEffect } from 'react';
import { buscarRotaDoDia, confirmarVisitaRota, removerRevisitar } from '../actions/rota';
import { salvarEdicaoCliente } from '../actions';
import { ArrowLeft, CalendarDays, MapPin, Navigation, Phone, User, CheckCircle, Clock, Trash2, Route, FileText, ChevronDown, ChevronUp, Pencil, X, Save } from 'lucide-react';
import Link from 'next/link';

// ─── Funções de Otimização de Rota (idênticas ao ParceirosClient) ───────────

async function otimizarRotaORS(
  clientes: any[],
  startLat: number,
  startLng: number,
  apiKey: string
): Promise<any[]> {
  const comCoords = clientes.filter(c => c.lat && c.lng);
  const semCoords = clientes.filter(c => !c.lat || !c.lng);
  if (comCoords.length === 0) return clientes;

  const jobs = comCoords.map((c, i) => ({
    id: i + 1,
    location: [Number(c.lng), Number(c.lat)],
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

function organizarRotaLocal(clientes: any[], startLat?: number, startLng?: number): any[] {
  if (clientes.length <= 1) return clientes;

  // Se não tem GPS, usa order da data de agendamento
  if (startLat === undefined || startLng === undefined) return clientes;

  // Com GPS: coloca o mais próximo primeiro, depois ordena por distância acumulada (nearest neighbor)
  const comCoords = clientes.filter(c => c.lat && c.lng);
  if (comCoords.length === 0) return clientes;

  const semCoords = clientes.filter(c => !c.lat || !c.lng);

  // Greedy nearest-neighbor
  const visitados = new Set<number>();
  const ordem: any[] = [];
  let atualLat = startLat;
  let atualLng = startLng;

  while (ordem.length < comCoords.length) {
    let maisProximo: any = null;
    let menorDist = Infinity;
    comCoords.forEach((c, i) => {
      if (visitados.has(i)) return;
      const d = (Number(c.lat) - atualLat) ** 2 + (Number(c.lng) - atualLng) ** 2;
      if (d < menorDist) { menorDist = d; maisProximo = { c, i }; }
    });
    if (!maisProximo) break;
    visitados.add(maisProximo.i);
    ordem.push(maisProximo.c);
    atualLat = Number(maisProximo.c.lat);
    atualLng = Number(maisProximo.c.lng);
  }

  return [...ordem, ...semCoords];
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function RotaPage() {
  const today = new Date().toISOString().split('T')[0];
  const [dataSelecionada, setDataSelecionada] = useState(today);
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [buscado, setBuscado] = useState(false);

  // Mini-dossiê expandido por card
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [notasTemp, setNotasTemp] = useState<Record<number, string>>({});
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [removendoId, setRemovendoId] = useState<number | null>(null);

  // Organização de rota
  const [rotaOrganizada, setRotaOrganizada] = useState(false);
  const [ordemRota, setOrdemRota] = useState<any[]>([]);
  const [organizandoRota, setOrganizandoRota] = useState(false);

  // Modal de edição
  const [editando, setEditando] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const abrirEdicao = (c: any) => {
    setEditando(c);
    setEditForm({
      nome_contato: c.nome_contato || '',
      telefone: c.telefone || '',
      endereco: c.endereco || '',
      bairro: c.bairro || '',
      cidade: c.cidade || '',
      prioridade: c.prioridade || '',
      status: c.status || '',
      observacao_atendimento: c.observacao_atendimento || '',
      revisitar: c.revisitar ? new Date(c.revisitar).toISOString().split('T')[0] : '',
      // campos obrigatórios da action (mantém valores atuais)
      prazo_pagamento: c.prazo_pagamento || '',
      cnpj: c.cnpj || '',
      inscricao_estadual: c.inscricao_estadual || '',
      email_xml: c.email_xml || '',
      email_financeiro: c.email_financeiro || '',
      rede: c.rede || '',
      sub_rede: c.sub_rede || '',
    });
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    setSalvandoEdicao(true);
    const res = await salvarEdicaoCliente(editando.id, editForm);
    if (res.success) {
      const updated = { ...editando, ...editForm };
      setClientes(prev => prev.map(c => c.id === editando.id ? updated : c));
      if (rotaOrganizada) setOrdemRota(prev => prev.map(c => c.id === editando.id ? updated : c));
      setEditando(null);
    } else {
      alert('Erro ao salvar: ' + res.error);
    }
    setSalvandoEdicao(false);
  };

  useEffect(() => { handleBuscar(today); }, []);

  const handleBuscar = async (data: string) => {
    setLoading(true);
    setDataSelecionada(data);
    const res = await buscarRotaDoDia(data);
    if (res.success) {
      setClientes(res.data || []);
    }
    setBuscado(true);
    setLoading(false);
    setExpandidoId(null);
    // Reseta a organização quando muda de data
    setRotaOrganizada(false);
    setOrdemRota([]);
  };

  const handleOrganizarRota = () => {
    const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;

    const aplicarLocal = (lat?: number, lng?: number) => {
      setOrdemRota(organizarRotaLocal(clientes, lat, lng));
      setRotaOrganizada(true);
      setOrganizandoRota(false);
    };

    const aplicarComGPS = async (lat: number, lng: number) => {
      if (apiKey) {
        try {
          const ordem = await otimizarRotaORS(clientes, lat, lng, apiKey);
          setOrdemRota(ordem);
          setRotaOrganizada(true);
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
    setRotaOrganizada(false);
    setOrdemRota([]);
  };

  const moverNaRota = (idx: number, direcao: 'up' | 'down') => {
    const novaLista = [...ordemRota];
    const swapIdx = direcao === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= novaLista.length) return;
    [novaLista[idx], novaLista[swapIdx]] = [novaLista[swapIdx], novaLista[idx]];
    setOrdemRota(novaLista);
  };

  // Lista mostrada: organizada ou original
  const listaMostrada = rotaOrganizada ? ordemRota : clientes;

  // Clique em "Visita Feita" — abre o mini-dossiê para o usuário anotar
  const handleAbrirDossie = (id: number) => {
    setExpandidoId(prev => prev === id ? null : id);
  };

  // Confirmar visita: salva nota, muda status, remove do roteiro
  const handleConfirmarVisita = async (id: number) => {
    setConfirmandoId(id);
    const nota = notasTemp[id] || null;
    const res = await confirmarVisitaRota(id, nota);
    if (res.success) {
      const novaLista = clientes.filter(c => c.id !== id);
      setClientes(novaLista);
      if (rotaOrganizada) setOrdemRota(prev => prev.filter(c => c.id !== id));
      setExpandidoId(null);
    } else {
      alert('Erro ao confirmar visita: ' + res.error);
    }
    setConfirmandoId(null);
  };

  // Remove apenas o agendamento (sem marcar visita)
  const handleRemoverAgendamento = async (id: number) => {
    setRemovendoId(id);
    const res = await removerRevisitar(id);
    if (res.success) {
      const novaLista = clientes.filter(c => c.id !== id);
      setClientes(novaLista);
      if (rotaOrganizada) setOrdemRota(prev => prev.filter(c => c.id !== id));
    }
    setRemovendoId(null);
  };

  const handleAbrirRotaGoogleMaps = () => {
    const lista = listaMostrada.filter(c => c.endereco);
    if (lista.length === 0) {
      alert('Nenhum cliente com endereço registrado para montar a rota.');
      return;
    }
    const paradas = lista.slice(0, 10);
    const waypoints = paradas.slice(0, -1).map(c => encodeURIComponent(c.endereco)).join('/');
    const destino = encodeURIComponent(paradas[paradas.length - 1].endereco);
    const url = `https://www.google.com/maps/dir/Current+Location/${waypoints ? waypoints + '/' : ''}${destino}`;
    window.open(url, '_blank');
  };

  const prioridadeConfig: Record<string, { cor: string; label: string }> = {
    'ALTA': { cor: 'bg-rose-500', label: 'Alta' },
    'MEDIA': { cor: 'bg-amber-500', label: 'Média' },
    'BAIXA': { cor: 'bg-emerald-500', label: 'Baixa' },
  };

  const dataBR = dataSelecionada
    ? new Date(dataSelecionada + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    : '';

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="p-2 bg-[var(--card)] border border-[var(--border)] rounded-full hover:bg-[var(--secondary)] transition-colors">
              <ArrowLeft className="w-5 h-5 text-[var(--primary)]" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Route className="w-5 h-5 text-[var(--primary)]" />
                Rota de Visitas
              </h1>
              <p className="text-xs text-[var(--muted-foreground)]">Clique em "Visita Feita" para registrar e anotar</p>
            </div>
          </div>

          {/* Seletor de Data */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                type="date"
                value={dataSelecionada}
                onChange={e => handleBuscar(e.target.value)}
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>
            <button
              onClick={() => handleBuscar(today)}
              className="px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm font-bold hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors whitespace-nowrap"
            >
              Hoje
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)]" />
          </div>
        )}

        {!loading && buscado && (
          <>
            {/* Resumo + Botões de Rota */}
            <div className="glass-panel rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider font-bold mb-1">
                    {dataBR}
                  </p>
                  <p className="text-2xl font-bold">
                    {clientes.length} {clientes.length === 1 ? 'visita' : 'visitas'} agendadas
                  </p>
                  {rotaOrganizada && (
                    <span className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                      <Navigation className="w-3 h-3" />
                      Rota otimizada — arraste ▲▼ para reordenar
                    </span>
                  )}
                </div>
                {clientes.length > 0 && (
                  <button
                    onClick={handleAbrirRotaGoogleMaps}
                    className="magnetic-button flex items-center gap-2 bg-[var(--primary)] text-black px-4 py-3 rounded-xl font-bold text-sm"
                  >
                    <Navigation className="w-4 h-4" />
                    Abrir Rota
                  </button>
                )}
              </div>

              {/* Botão Organizar Rota */}
              {clientes.length > 1 && (
                <button
                  onClick={rotaOrganizada ? handleDesfazerRota : handleOrganizarRota}
                  disabled={organizandoRota}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 ${
                    rotaOrganizada
                      ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  {organizandoRota ? 'Obtendo GPS...' : rotaOrganizada ? 'Desfazer Ordem' : 'Organizar Rota'}
                </button>
              )}
            </div>

            {clientes.length === 0 ? (
              <div className="text-center py-12 text-[var(--muted-foreground)]">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma visita agendada para esse dia.</p>
                <p className="text-sm mt-1">Abra o Dossiê de um cliente e defina a data de retorno.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {listaMostrada.map((cliente, idx) => {
                  const prio = prioridadeConfig[cliente.prioridade] || prioridadeConfig['MEDIA'];
                  const aberto = expandidoId === cliente.id;

                  return (
                    <div key={cliente.id} className={`relative bg-[var(--card)] border rounded-2xl overflow-hidden transition-all duration-200 ${aberto ? 'border-[var(--primary)]/60 shadow-lg shadow-[var(--primary)]/10' : 'border-[var(--border)] hover:border-[var(--primary)]/30'}`}>
                      {/* Barra de prioridade */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${prio.cor}`} />

                      <div className="pl-4 pr-4 py-4">
                        {/* Cabeçalho do card */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
                            {/* Numeração e controles de ordem */}
                            {rotaOrganizada ? (
                              <div className="flex-shrink-0 flex flex-col items-center gap-0.5" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => moverNaRota(idx, 'up')}
                                  disabled={idx === 0}
                                  className="text-[10px] text-amber-400 hover:text-amber-300 disabled:opacity-20 disabled:cursor-not-allowed leading-none px-1"
                                >▲</button>
                                <div className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center text-sm font-black shadow-md shadow-amber-500/30">
                                  {idx + 1}
                                </div>
                                <button
                                  onClick={() => moverNaRota(idx, 'down')}
                                  disabled={idx === listaMostrada.length - 1}
                                  className="text-[10px] text-amber-400 hover:text-amber-300 disabled:opacity-20 disabled:cursor-not-allowed leading-none px-1"
                                >▼</button>
                              </div>
                            ) : (
                              <span className="w-7 h-7 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-bold flex items-center justify-center flex-shrink-0">
                                {idx + 1}
                              </span>
                            )}
                            <div>
                              <h3 className="font-bold text-base leading-tight">{cliente.nome_fantasia}</h3>
                              <span className={`text-xs font-medium ${cliente.status === 'Cliente' ? 'text-emerald-400' : cliente.status === 'Em Andamento' ? 'text-amber-400' : 'text-[var(--muted-foreground)]'}`}>
                                {cliente.status}
                              </span>
                            </div>
                          </div>
                          {/* Botões: editar + remover */}
                          <div className="flex gap-1">
                            <button
                              onClick={() => abrirEdicao(cliente)}
                              title="Editar cliente"
                              className="p-2 text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoverAgendamento(cliente.id)}
                              disabled={removendoId === cliente.id}
                              title="Cancelar agendamento sem registrar visita"
                              className="p-2 text-[var(--muted-foreground)] hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Informações */}
                        <div className="space-y-1.5 mb-3">
                          {cliente.endereco && (
                            <p className="text-xs text-[var(--muted-foreground)] flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                              {cliente.endereco}
                            </p>
                          )}
                          {cliente.nome_contato && (
                            <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-[var(--primary)] flex-shrink-0" />
                              {cliente.nome_contato}
                            </p>
                          )}
                          {cliente.telefone && (
                            <a href={`tel:${cliente.telefone}`} className="text-xs text-[var(--primary)] flex items-center gap-2 hover:underline">
                              <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                              {cliente.telefone}
                            </a>
                          )}
                          {cliente.observacao_rota && (
                            <p className="text-xs text-emerald-400 flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                              📍 {cliente.observacao_rota}
                            </p>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex gap-2 pt-3 border-t border-[var(--border)]/50">
                          {cliente.google_maps_url && (
                            <a
                              href={cliente.google_maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-xs bg-[var(--secondary)] text-[var(--secondary-foreground)] px-3 py-2 rounded-lg font-medium hover:bg-[var(--primary)] hover:text-black transition-colors"
                            >
                              <Navigation className="w-3 h-3" /> Navegar
                            </a>
                          )}
                          {/* BOTÃO VISITA FEITA */}
                          <button
                            onClick={() => handleAbrirDossie(cliente.id)}
                            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-bold transition-colors ${aberto ? 'bg-emerald-500 text-black' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black'}`}
                          >
                            <CheckCircle className="w-3 h-3" />
                            Visita Feita
                            {aberto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>

                        {/* Mini-dossiê expandido */}
                        {aberto && (
                          <div className="mt-4 pt-4 border-t border-[var(--primary)]/20 space-y-3 animate-in slide-in-from-top-2 duration-200">
                            {/* Histórico de notas existentes */}
                            {cliente.observacao_atendimento && (
                              <div className="bg-[var(--background)]/50 rounded-lg p-3">
                                <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <FileText className="w-3 h-3" /> Notas anteriores
                                </p>
                                <p className="text-xs text-[var(--muted-foreground)] italic whitespace-pre-wrap">
                                  {cliente.observacao_atendimento}
                                </p>
                              </div>
                            )}

                            {/* Campo de nota da visita atual */}
                            <div>
                              <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 flex items-center gap-1">
                                <FileText className="w-3 h-3 text-[var(--primary)]" /> 
                                Nota desta visita <span className="text-[var(--muted-foreground)] normal-case font-normal">(opcional)</span>
                              </label>
                              <textarea
                                value={notasTemp[cliente.id] || ''}
                                onChange={e => setNotasTemp(prev => ({ ...prev, [cliente.id]: e.target.value }))}
                                placeholder={`Ex: Gerente pediu retorno em 15 dias. Interessado em 2 caixas de sorvete...`}
                                rows={3}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-sm focus:border-[var(--primary)] outline-none resize-none placeholder:text-[var(--muted-foreground)]/60"
                              />
                            </div>

                            {/* Info do que vai acontecer */}
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                              <p className="text-xs text-emerald-400">
                                ✅ Ao confirmar: visita registrada em <strong>{new Date().toLocaleDateString('pt-BR')}</strong>, status → <strong>Em Andamento</strong>, removido da rota de hoje.
                              </p>
                            </div>

                            {/* Botão de confirmar */}
                            <button
                              onClick={() => handleConfirmarVisita(cliente.id)}
                              disabled={confirmandoId === cliente.id}
                              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {confirmandoId === cliente.id ? 'Confirmando...' : 'Confirmar Visita'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {listaMostrada.filter(c => c.endereco).length > 10 && (
              <p className="text-xs text-amber-400 text-center">
                ⚠️ O Google Maps suporta até 10 paradas. A rota foi montada com as 10 primeiras visitas.
              </p>
            )}
          </>
        )}
      </div>

      {/* Modal de Edição */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card)] w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-start bg-[var(--secondary)]/30">
              <div>
                <h2 className="text-lg font-bold text-[var(--primary)]">{editando.nome_fantasia}</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Editar informações do cliente</p>
              </div>
              <button onClick={() => setEditando(null)} className="p-1 hover:bg-[var(--muted)] rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Status</p>
                <div className="flex gap-2 flex-wrap">
                  {(['Não iniciada', 'Em Andamento', 'Cliente', 'Descartado'] as const).map(s => (
                    <button key={s} onClick={() => setEditForm((f: any) => ({ ...f, status: s }))}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${editForm.status === s ? s === 'Cliente' ? 'bg-emerald-500 text-white border-emerald-500' : s === 'Em Andamento' ? 'bg-amber-500 text-black border-amber-500' : s === 'Descartado' ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-500 text-white border-slate-500' : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Prioridade</p>
                <div className="flex gap-2">
                  {(['ALTA', 'MEDIA', 'BAIXA'] as const).map(p => (
                    <button key={p} onClick={() => setEditForm((f: any) => ({ ...f, prioridade: p }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${editForm.prioridade === p ? p === 'ALTA' ? 'bg-rose-500 text-white border-rose-500' : p === 'MEDIA' ? 'bg-amber-500 text-black border-amber-500' : 'bg-emerald-500 text-white border-emerald-500' : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)]'}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Contato</label>
                  <input type="text" value={editForm.nome_contato} onChange={e => setEditForm((f: any) => ({ ...f, nome_contato: e.target.value }))} className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--primary)] outline-none" placeholder="Nome do contato" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Telefone</label>
                  <input type="text" value={editForm.telefone} onChange={e => setEditForm((f: any) => ({ ...f, telefone: e.target.value }))} className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--primary)] outline-none" placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Endereço</label>
                <input type="text" value={editForm.endereco} onChange={e => setEditForm((f: any) => ({ ...f, endereco: e.target.value }))} className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--primary)] outline-none" placeholder="Rua, número" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Bairro</label>
                  <input type="text" value={editForm.bairro} onChange={e => setEditForm((f: any) => ({ ...f, bairro: e.target.value }))} className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--primary)] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Cidade</label>
                  <input type="text" value={editForm.cidade} onChange={e => setEditForm((f: any) => ({ ...f, cidade: e.target.value }))} className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--primary)] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Próxima Visita</label>
                <input type="date" value={editForm.revisitar} onChange={e => setEditForm((f: any) => ({ ...f, revisitar: e.target.value }))} className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--primary)] outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Notas de Atendimento</label>
                <textarea rows={3} value={editForm.observacao_atendimento} onChange={e => setEditForm((f: any) => ({ ...f, observacao_atendimento: e.target.value }))} className="w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--primary)] outline-none resize-none" placeholder="Observações..." />
              </div>
            </div>
            <div className="p-5 border-t border-[var(--border)] flex gap-3">
              <button onClick={() => setEditando(null)} className="flex-1 py-3 rounded-xl text-sm font-bold border border-[var(--border)] text-[var(--muted-foreground)] hover:border-white hover:text-white transition-all">Cancelar</button>
              <button onClick={salvarEdicao} disabled={salvandoEdicao} className="flex-1 py-3 rounded-xl text-sm font-bold bg-[var(--primary)] text-black hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />{salvandoEdicao ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

