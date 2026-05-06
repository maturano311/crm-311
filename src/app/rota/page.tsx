'use client';

import { useState, useEffect } from 'react';
import { buscarRotaDoDia, confirmarVisitaRota, removerRevisitar } from '../actions/rota';
import { ArrowLeft, CalendarDays, MapPin, Navigation, Phone, User, CheckCircle, Clock, Trash2, Route, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

export default function RotaPage() {
  const today = new Date().toISOString().split('T')[0];
  const [dataSelecionada, setDataSelecionada] = useState(today);
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [buscado, setBuscado] = useState(false);

  // Mini-dossiê expandido por card
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  // Notas por card (chave = id do cliente)
  const [notasTemp, setNotasTemp] = useState<Record<number, string>>({});
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [removendoId, setRemovendoId] = useState<number | null>(null);

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
  };

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
      setClientes(prev => prev.filter(c => c.id !== id));
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
      setClientes(prev => prev.filter(c => c.id !== id));
    }
    setRemovendoId(null);
  };

  const handleAbrirRotaGoogleMaps = () => {
    const comEndereco = clientes.filter(c => c.endereco);
    if (comEndereco.length === 0) {
      alert('Nenhum cliente com endereço registrado para montar a rota.');
      return;
    }
    const paradas = comEndereco.slice(0, 10);
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
            {/* Resumo */}
            <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider font-bold mb-1">
                  {dataBR}
                </p>
                <p className="text-2xl font-bold">
                  {clientes.length} {clientes.length === 1 ? 'visita' : 'visitas'} agendadas
                </p>
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

            {clientes.length === 0 ? (
              <div className="text-center py-12 text-[var(--muted-foreground)]">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma visita agendada para esse dia.</p>
                <p className="text-sm mt-1">Abra o Dossiê de um cliente e defina a data de retorno.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clientes.map((cliente, idx) => {
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
                            <span className="w-7 h-7 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <h3 className="font-bold text-base leading-tight">{cliente.nome_fantasia}</h3>
                              <span className={`text-xs font-medium ${cliente.status === 'Cliente' ? 'text-emerald-400' : cliente.status === 'Em Andamento' ? 'text-amber-400' : 'text-[var(--muted-foreground)]'}`}>
                                {cliente.status}
                              </span>
                            </div>
                          </div>
                          {/* Botão remover agendamento (discreto) */}
                          <button
                            onClick={() => handleRemoverAgendamento(cliente.id)}
                            disabled={removendoId === cliente.id}
                            title="Cancelar agendamento sem registrar visita"
                            className="p-2 text-[var(--muted-foreground)] hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                          {/* BOTÃO VISITA FEITA — abre mini-dossiê */}
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

            {clientes.filter(c => c.endereco).length > 10 && (
              <p className="text-xs text-amber-400 text-center">
                ⚠️ O Google Maps suporta até 10 paradas. A rota foi montada com as 10 primeiras visitas.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
