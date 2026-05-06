'use server';

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Faz geocoding da cidade para melhorar a busca
async function geocodificar(cidade: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cidade)}&key=${GOOGLE_API_KEY}&language=pt-BR`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK') {
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

export async function buscarLeadsNoGoogle(cidade: string, tipo: string) {
  if (!GOOGLE_API_KEY) {
    return { success: false, error: 'GOOGLE_API_KEY não configurada no servidor.' };
  }

  const coords = await geocodificar(cidade);
  
  let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${tipo} em ${cidade}`)}&key=${GOOGLE_API_KEY}&language=pt-BR`;
  
  if (coords) {
    url += `&location=${coords.lat},${coords.lng}&radius=15000`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return { success: false, error: `Erro na API do Google: ${data.status}` };
    }

    const resultados = data.results || [];
    
    // Agora precisamos descobrir quais desses já existem no nosso banco (PostgreSQL)
    // Coletamos todos os place_ids retornados
    const placeIds = resultados.map((r: any) => r.place_id).filter(Boolean);
    
    let existentes = new Set<string>();
    
    if (placeIds.length > 0) {
      // Usamos = ANY($1) com o PostgreSQL driver pg para comparar arrays eficientemente
      const query = `SELECT google_place_id, status FROM clientes WHERE google_place_id = ANY($1::varchar[])`;
      const result = await pool.query(query, [placeIds]);
      
      result.rows.forEach(row => {
        if (row.google_place_id) {
          // Salva o status atual (ex: Cliente, Em Andamento)
          existentes.add(row.google_place_id);
        }
      });
    }

    // Processa a resposta para devolver ao front-end
    const leadsProcessados = resultados.map((place: any) => {
      // Calcula prioridade exatamente como no python
      let prioridade = 'MEDIA';
      const rating = place.rating || 0;
      const reviews = place.user_ratings_total || 0;
      if (rating >= 4.0 && reviews >= 50) prioridade = 'ALTA';
      else if (rating < 3.5 || reviews < 10) prioridade = 'BAIXA';

      // Pega bairro (tentativa pelo formatted_address)
      const addressParts = (place.formatted_address || '').split('-');
      let bairro = '';
      if (addressParts.length >= 2) {
         bairro = addressParts[1].split(',')[0].trim();
      }

      return {
        nome: place.name,
        endereco: place.formatted_address,
        bairro: bairro,
        cidade: cidade.split('-')[0].trim() || cidade,
        google_place_id: place.place_id,
        rating: rating,
        reviews: reviews,
        prioridade: prioridade,
        lat: place.geometry?.location?.lat,
        lng: place.geometry?.location?.lng,
        // Informa o front-end se já temos ele
        ja_existe: existentes.has(place.place_id)
      };
    });

    return { success: true, data: leadsProcessados };

  } catch (error: any) {
    console.error('Erro na busca do Google Maps:', error);
    return { success: false, error: 'Erro interno ao consultar o Google Maps' };
  }
}

export async function adicionarLead(lead: any, tipoLabel: string) {
  try {
    // Verificação de duplicidade por google_place_id
    if (lead.google_place_id) {
      const dup = await pool.query(
        'SELECT id FROM clientes WHERE google_place_id = $1 LIMIT 1',
        [lead.google_place_id]
      );
      if (dup.rows.length > 0) {
        return { success: false, error: 'Este estabelecimento já existe na sua base de leads.' };
      }
    }

    const mapsUrl = (lead.lat && lead.lng) ? `https://waze.com/ul?ll=${lead.lat},${lead.lng}&navigate=yes` : null;

    await pool.query(`
      INSERT INTO clientes (
        nome_fantasia, endereco, bairro, cidade, tipo, 
        status, tipo_entrada, prioridade, google_place_id, google_maps_url
      ) VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, $9, $10
      )
    `, [
      lead.nome, 
      lead.endereco, 
      lead.bairro, 
      lead.cidade, 
      tipoLabel,
      'Não iniciada', 
      'A PROSPECTAR', 
      lead.prioridade, 
      lead.google_place_id, 
      mapsUrl
    ]);

    revalidatePath('/radar');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao adicionar lead:', error);
    return { success: false, error: error.message };
  }
}

// Fase 8: Cadastro de Rua Manual com Reverse Geocoding
export async function reverseGeocode(lat: number, lng: number) {
  if (!GOOGLE_API_KEY) return { success: false, error: 'API Key não configurada.' };

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}&language=pt-BR`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results.length > 0) {
      const address = data.results[0];
      
      // Extrair componentes do endereço
      let rua = '';
      let numero = '';
      let bairro = '';
      let cidade = '';

      address.address_components.forEach((component: any) => {
        const types = component.types;
        if (types.includes('route')) rua = component.long_name;
        if (types.includes('street_number')) numero = component.long_name;
        if (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('political')) bairro = component.long_name;
        if (types.includes('administrative_area_level_2')) cidade = component.long_name;
      });

      const enderecoCompleto = `${rua}${numero ? `, ${numero}` : ''}`;
      
      return { 
        success: true, 
        data: { 
          endereco: enderecoCompleto || address.formatted_address, 
          bairro: bairro, 
          cidade: cidade,
          formatted: address.formatted_address
        } 
      };
    }
    return { success: false, error: 'Nenhum endereço encontrado.' };
  } catch (error) {
    console.error('Erro no Geocoding:', error);
    return { success: false, error: 'Erro de conexão com o Google.' };
  }
}

export async function adicionarLeadManual(dados: any) {
  try {
    // Verificação de duplicidade por endereço completo
    if (dados.endereco && dados.endereco.trim() !== '') {
      const dup = await pool.query(
        'SELECT id FROM clientes WHERE endereco ILIKE $1 LIMIT 1',
        [dados.endereco.trim()]
      );
      if (dup.rows.length > 0) {
        return {
          success: false,
          error: `Já existe um lead cadastrado neste endereço: "${dados.endereco}".`
        };
      }
    }

    const mapsUrl = (dados.lat && dados.lng) ? `https://waze.com/ul?ll=${dados.lat},${dados.lng}&navigate=yes` : null;

    let data_visitacao = null;
    if (dados.status === 'Em Andamento' || dados.status === 'Cliente') {
      data_visitacao = new Date();
    }

    await pool.query(`
      INSERT INTO clientes (
        nome_fantasia, tipo, status, tipo_entrada, prioridade,
        endereco, bairro, cidade, google_maps_url, data_visitacao
      ) VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, $9, $10
      )
    `, [
      dados.nome_fantasia, 
      dados.tipo, 
      dados.status || 'Não iniciada', 
      dados.tipo_entrada || 'A PROSPECTAR', 
      'MEDIA',
      dados.endereco, 
      dados.bairro, 
      dados.cidade, 
      mapsUrl,
      data_visitacao
    ]);

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao adicionar lead manual:', error);
    return { success: false, error: error.message };
  }
}
