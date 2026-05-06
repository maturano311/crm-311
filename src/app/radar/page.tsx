'use client';

import { useState } from 'react';
import { buscarLeadsNoGoogle, adicionarLead } from '../actions/radar';
import { Search, MapPin, Star, PlusCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RadarPage() {
  const [cidade, setCidade] = useState('');
  const [tipo, setTipo] = useState('SUPERMERCADO');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cidade) return;
    
    setLoading(true);
    setResultados([]);
    
    const res = await buscarLeadsNoGoogle(cidade, tipo);
    if (res.success && res.data) {
      setResultados(res.data);
    } else {
      alert(res.error || 'Erro ao buscar leads');
    }
    setLoading(false);
  };

  const handleAdicionar = async (lead: any) => {
    setAddingId(lead.google_place_id);
    const res = await adicionarLead(lead, tipo);
    
    if (res.success) {
      // Marca o lead atual como existente no estado para ele não ser adicionado de novo
      setResultados(prev => prev.map(r => 
        r.google_place_id === lead.google_place_id ? { ...r, ja_existe: true } : r
      ));
    } else {
      alert(res.error || 'Erro ao adicionar lead');
    }
    setAddingId(null);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 md:p-6 font-sans">
      <header className="flex items-center gap-4 mb-8">
        <Link href="/" className="p-2 bg-[var(--card)] border border-[var(--border)] rounded-full hover:bg-[var(--secondary)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--primary)]" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Search className="w-6 h-6 text-[var(--primary)]" />
            Radar de Leads
          </h1>
          <p className="text-[var(--muted-foreground)] text-sm md:text-base">Mapeie novos negócios pelo Google Places</p>
        </div>
      </header>

      <div className="glass-panel p-6 rounded-2xl mb-8">
        <form onSubmit={handleBuscar} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Cidade/Região</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
              <input 
                type="text" 
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex: Teresópolis RJ"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-sm)] py-3 pl-10 pr-4 focus:outline-none focus:border-[var(--primary)] transition-colors"
                required
              />
            </div>
          </div>
          
          <div className="md:w-1/3">
            <label className="block text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Tipo de Negócio</label>
            <select 
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-sm)] py-3 px-4 focus:outline-none focus:border-[var(--primary)] transition-colors appearance-none"
            >
              <option value="MERCADO">MERCADO</option>
              <option value="SUPERMERCADO">SUPERMERCADO</option>
              <option value="PADARIA">PADARIA</option>
              <option value="RESTAURANTE">RESTAURANTE</option>
              <option value="MERCADINHO">MERCADINHO</option>
              <option value="HORTFRUT">HORTFRUT</option>
            </select>
          </div>

          <div className="flex items-end">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full md:w-auto magnetic-button bg-[var(--primary)] text-black px-8 py-3 rounded-[var(--radius-sm)] font-bold text-lg disabled:opacity-50"
            >
              {loading ? 'Rastreando...' : 'Buscar'}
            </button>
          </div>
        </form>
      </div>

      {/* Resultados */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
        </div>
      )}

      {!loading && resultados.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold mb-4">Encontrados: {resultados.length} leads</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {resultados.map((lead, idx) => (
              <div key={idx} className={`p-5 rounded-xl border ${lead.ja_existe ? 'bg-[var(--muted)]/20 border-[var(--border)] opacity-70' : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--primary)]/50'} transition-colors flex flex-col justify-between`}>
                
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{lead.nome}</h3>
                    <p className="text-sm text-[var(--muted-foreground)] mt-1">{lead.endereco}</p>
                  </div>
                  
                  {lead.ja_existe ? (
                    <span className="flex items-center gap-1 text-xs font-bold bg-[var(--secondary)] text-[var(--secondary-foreground)] px-2 py-1 rounded-full whitespace-nowrap">
                      <CheckCircle className="w-3 h-3" /> Na Base
                    </span>
                  ) : (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${lead.prioridade === 'ALTA' ? 'bg-rose-500/20 text-rose-400' : lead.prioridade === 'BAIXA' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {lead.prioridade}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--border)]/50">
                  <div className="flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
                    <Star className="w-4 h-4 text-amber-400" />
                    {lead.rating} ({lead.reviews} avaliações)
                  </div>
                  
                  {!lead.ja_existe && (
                    <button 
                      onClick={() => handleAdicionar(lead)}
                      disabled={addingId === lead.google_place_id}
                      className="flex items-center gap-2 bg-transparent border border-[var(--primary)] text-[var(--primary)] px-4 py-1.5 rounded font-bold hover:bg-[var(--primary)] hover:text-black transition-colors text-sm disabled:opacity-50 disabled:bg-[var(--primary)] disabled:text-black"
                    >
                      {addingId === lead.google_place_id ? 'Adicionando...' : (
                        <>
                          <PlusCircle className="w-4 h-4" /> Adicionar
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
