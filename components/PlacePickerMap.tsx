"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_COORDS, BASE_LABEL } from "@/lib/geo";

function balloonIcon(color: string) {
  return L.divIcon({
    className: "place-balloon",
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    html: `<div style="width:28px;height:36px;display:flex;align-items:flex-end;justify-content:center">
      <div style="width:22px;height:22px;border-radius:999px 999px 2px 999px;transform:rotate(45deg);background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>
    </div>`,
  });
}

export function PlacePickerMap({
  center,
  pin,
  onDrop,
}: {
  center: { lat: number; lng: number };
  pin?: { lat: number; lng: number } | null;
  onDrop: (lat: number, lng: number) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, { scrollWheelZoom: true }).setView(
      [center.lat, center.lng],
      13,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    const base = L.latLng(BASE_COORDS.lat, BASE_COORDS.lng);
    L.marker(base, {
      icon: balloonIcon("#c9a227"),
      interactive: true,
      keyboard: false,
    })
      .bindTooltip(`Base · ${BASE_LABEL}`, {
        permanent: true,
        direction: "right",
        offset: [12, -16],
        className: "base-map-label",
      })
      .addTo(map);
    const start = L.latLng(center.lat, center.lng);
    if (start.distanceTo(base) < 18000) {
      map.fitBounds(L.latLngBounds([start, base]).pad(0.35), { maxZoom: 15 });
    }
    map.on("click", (event: L.LeafletMouseEvent) => {
      onDropRef.current(event.latlng.lat, event.latlng.lng);
    });
    mapRef.current = map;
    const id = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      window.clearTimeout(id);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pin) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      markerRef.current = L.marker([pin.lat, pin.lng], {
        icon: balloonIcon("#0f3a5f"),
        draggable: true,
      })
        .addTo(map)
        .on("dragend", () => {
          const pos = markerRef.current?.getLatLng();
          if (pos) onDropRef.current(pos.lat, pos.lng);
        });
      map.setView([pin.lat, pin.lng], Math.max(map.getZoom(), 16));
      return;
    }
    const current = markerRef.current.getLatLng();
    if (
      Math.abs(current.lat - pin.lat) > 1e-7 ||
      Math.abs(current.lng - pin.lng) > 1e-7
    ) {
      markerRef.current.setLatLng([pin.lat, pin.lng]);
    }
    if (!map.getBounds().pad(-0.2).contains([pin.lat, pin.lng])) {
      map.panTo([pin.lat, pin.lng]);
    }
  }, [pin?.lat, pin?.lng]);

  return <div ref={elRef} className="z-0 h-64 w-full" />;
}
