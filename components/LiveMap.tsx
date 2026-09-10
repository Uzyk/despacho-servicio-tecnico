"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_COORDS, BASE_LABEL, type MapPin } from "@/lib/geo";
import type { TechPhase } from "@/lib/live";

const COLORS: Record<TechPhase, string> = {
  sin_iniciar: "#78716c",
  en_locacion: "#d97706",
  llego: "#059669",
  pernocta: "#7c3aed",
  en_transito: "#1e3a5f",
  terminada: "#57534e",
};

function pinIcon(phase: TechPhase, label: string) {
  const color = COLORS[phase];
  return L.divIcon({
    className: "live-pin",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
    html: `<div title="${label}" style="width:28px;height:28px;border-radius:999px;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  });
}

export function LiveMap({
  pins,
  tall = false,
}: {
  pins: MapPin[];
  tall?: boolean;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, { scrollWheelZoom: true }).setView(
      [BASE_COORDS.lat, BASE_COORDS.lng],
      6,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const id = window.setTimeout(() => map.invalidateSize(), 120);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => {
      window.clearTimeout(id);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const points = [
      [BASE_COORDS.lat, BASE_COORDS.lng] as L.LatLngTuple,
      ...pins.map((pin) => [pin.lat, pin.lng] as L.LatLngTuple),
    ];
    L.marker([BASE_COORDS.lat, BASE_COORDS.lng], {
      icon: L.divIcon({
        className: "live-pin",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16],
        html: `<div title="Base · ${BASE_LABEL}" style="width:28px;height:28px;border-radius:999px;background:#c9a227;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
      }),
    })
      .bindPopup(
        `<p style="margin:0;font-weight:700">Base</p><p style="margin:4px 0 0">${BASE_LABEL}</p><p style="margin:4px 0 0;font-size:11px;color:#57534e">Av. Vicuña Mackenna 3864, Macul</p>`,
      )
      .addTo(layer);
    for (const pin of pins) {
      L.marker([pin.lat, pin.lng], { icon: pinIcon(pin.phase, pin.label) })
        .bindPopup(
          `<p style="margin:0;font-weight:700">${pin.label}</p><p style="margin:4px 0 0">${pin.detail}</p><p style="margin:4px 0 0;font-size:11px;color:#57534e">GPS ${pin.gps}</p>`,
        )
        .addTo(layer);
    }
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
    } else {
      map.setView([BASE_COORDS.lat, BASE_COORDS.lng], 6);
    }
  }, [pins]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-navy">Mapa GPS</h2>
        </div>
        <ul className="flex flex-wrap gap-3 text-[11px] font-medium text-stone-500">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-gold" /> Base INACAP
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> Trabajando
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-navy" /> En tránsito
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Llegó
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> Pernocta
          </li>
        </ul>
      </div>
      <div ref={elRef} className={`z-0 w-full ${tall ? "h-[min(62vh,560px)]" : "h-80"}`} />
    </div>
  );
}
