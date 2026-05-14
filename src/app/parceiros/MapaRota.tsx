'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  parceiros: any[];
  userLat?: number;
  userLng?: number;
  onClose: () => void;
}

export default function MapaRota({ parceiros, userLat, userLng, onClose }: Props) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      const comCoords = parceiros.filter(p => p.lat && p.lng);
      if (comCoords.length === 0) return;

      const bounds: [number, number][] = comCoords.map(p => [Number(p.lat), Number(p.lng)]);
      if (userLat && userLng) bounds.unshift([userLat, userLng]);

      const map = L.map(containerRef.current!).fitBounds(bounds, { padding: [40, 40] });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // Marcador do usuário
      if (userLat && userLng) {
        L.circleMarker([userLat, userLng], {
          radius: 10, fillColor: '#06b6d4', color: '#fff', weight: 2,
          fillOpacity: 1,
        }).bindPopup('📍 Você está aqui').addTo(map);
      }

      // Marcadores numerados dos parceiros
      comCoords.forEach((p, i) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:#f59e0b;color:#000;font-weight:900;font-size:12px;
            width:28px;height:28px;border-radius:50%;display:flex;
            align-items:center;justify-content:center;
            border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);
            font-family:sans-serif;
          ">${i + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([Number(p.lat), Number(p.lng)], { icon })
          .bindPopup(`<b>${i + 1}. ${p.nome_fantasia}</b><br/>${p.bairro || ''} ${p.cidade || ''}`)
          .addTo(map);
      });

      // Linha da rota — tenta pegar geometria real pelo ORS
      const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;
      const coords: [number, number][] = [
        ...(userLat && userLng ? [[userLng, userLat] as [number, number]] : []),
        ...comCoords.map(p => [Number(p.lng), Number(p.lat)] as [number, number]),
      ];

      let routeDrawn = false;
      if (apiKey && coords.length >= 2) {
        try {
          const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
            method: 'POST',
            headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: coords }),
          });
          if (res.ok) {
            const geojson = await res.json();
            L.geoJSON(geojson, {
              style: { color: '#f59e0b', weight: 4, opacity: 0.8 },
            }).addTo(map);
            routeDrawn = true;
          }
        } catch {}
      }

      // Fallback: linha reta entre os pontos
      if (!routeDrawn) {
        const latlngs: [number, number][] = [
          ...(userLat && userLng ? [[userLat, userLng] as [number, number]] : []),
          ...comCoords.map(p => [Number(p.lat), Number(p.lng)] as [number, number]),
        ];
        L.polyline(latlngs, { color: '#f59e0b', weight: 4, opacity: 0.7, dashArray: '8 6' }).addTo(map);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--card)] border-b border-[var(--border)]">
        <div>
          <h3 className="font-bold text-amber-400">Mapa da Rota</h3>
          <p className="text-xs text-[var(--muted-foreground)]">{parceiros.filter(p => p.lat && p.lng).length} paradas • linha amarela = rota</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-[var(--muted)] rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
