import { PHASE_LABEL, type RouteLive, type TechPhase } from "./live";
import type { AppData, Location, Stop, StopProgress } from "./types";

export const BASE_LOCATION_ID = "loc-base";
export const BASE_LABEL = "INACAP Santiago Sur";
export const BASE_ADDRESS =
  "Av. Vicuña Mackenna 3864, Macul, Santiago, Chile";
export const BASE_COORDS = { lat: -33.49033, lng: -70.61679 };

const CITY_COORDS: Record<string, [number, number]> = {
  "Santiago (base)": [BASE_COORDS.lat, BASE_COORDS.lng],
  "INACAP Santiago Sur (base)": [BASE_COORDS.lat, BASE_COORDS.lng],
  "INACAP Santiago Sur": [BASE_COORDS.lat, BASE_COORDS.lng],
  Santiago: [-33.4489, -70.6693],
  Valparaíso: [-33.0472, -71.6127],
  Arica: [-18.4783, -70.3126],
  Iquique: [-20.2307, -70.1357],
  Antofagasta: [-23.6509, -70.3975],
  Copiapó: [-27.3668, -70.3323],
  "La Serena": [-29.9027, -71.252],
  Coquimbo: [-29.9533, -71.3395],
  "La Calera": [-32.7872, -71.1983],
  "San Antonio": [-33.5957, -71.6165],
  Melipilla: [-33.6861, -71.2169],
  "Lo Barnechea": [-33.3533, -70.5167],
  "Puente Alto": [-33.6117, -70.5758],
  Pudahuel: [-33.4366, -70.7508],
  Maipú: [-33.5114, -70.7581],
  Curicó: [-34.9833, -71.2396],
  Talca: [-35.4264, -71.6554],
  Concepción: [-36.827, -73.0503],
  Chillán: [-36.6067, -72.1034],
  Temuco: [-38.7359, -72.5904],
  Valdivia: [-39.8142, -73.2459],
  "Puerto Montt": [-41.4693, -72.9424],
  Coyhaique: [-45.5712, -72.0685],
  "Punta Arenas": [-53.1638, -70.9171],
  Rancagua: [-34.1708, -70.7444],
  "San Pedro de la Paz": [-36.8408, -73.1031],
  Penco: [-36.7406, -72.9953],
  Tomé: [-36.6167, -72.9561],
  "Santa Juana": [-37.1731, -72.9372],
};

export function haversineKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function kmBetween(a: [number, number], b: [number, number]) {
  return haversineKm(
    { lat: a[0], lng: a[1] },
    { lat: b[0], lng: b[1] },
  );
}

export type GeoFix = {
  lat: number;
  lng: number;
  accuracyM?: number;
};

export function formatGps(lat?: number, lng?: number) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return "";
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function requestFix(): Promise<GeoFix | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM:
            Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : undefined,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 20000 },
    );
  });
}

export function pingCoords(
  progress: StopProgress | undefined,
  when: "arrive" | "leave",
): [number, number] | null {
  if (!progress) return null;
  if (
    when === "leave" &&
    progress.leftLat != null &&
    progress.leftLng != null
  ) {
    return [progress.leftLat, progress.leftLng];
  }
  if (progress.arrivedLat != null && progress.arrivedLng != null) {
    return [progress.arrivedLat, progress.arrivedLng];
  }
  return null;
}

export function coordsOfStop(data: AppData, stop?: Stop | null) {
  if (!stop) return null;
  if (stop.destLat != null && stop.destLng != null) {
    return [stop.destLat, stop.destLng] as [number, number];
  }
  return coordsById(data, stop.locationId);
}

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  detail: string;
  phase: TechPhase;
  gps: string;
};

export function coordsOf(location: Location): [number, number] | null {
  if (location.lat != null && location.lng != null) {
    return [location.lat, location.lng];
  }
  return CITY_COORDS[location.name] ?? null;
}

export function coordsById(data: AppData, locationId: string) {
  const location = data.locations.find((l) => l.id === locationId);
  return location ? coordsOf(location) : null;
}

function lerp(from: [number, number], to: [number, number], t: number) {
  const clamped = Math.min(0.85, Math.max(0.15, t));
  return [
    from[0] + (to[0] - from[0]) * clamped,
    from[1] + (to[1] - from[1]) * clamped,
  ] as [number, number];
}

function stopOf(data: AppData, stopId?: string) {
  if (!stopId) return undefined;
  return data.stops.find((s) => s.id === stopId);
}

function progressOfTech(
  data: AppData,
  stopId: string | undefined,
  technicianId: string,
) {
  if (!stopId) return undefined;
  return data.progress.find(
    (p) => p.stopId === stopId && p.technicianId === technicianId,
  );
}

function pointForTech(
  data: AppData,
  tech: RouteLive["techs"][number],
  nowMs: number,
): [number, number] | null {
  const hereStop = stopOf(data, tech.stopId);
  const nextStop = stopOf(data, tech.nextStopId);
  const hereProgress = progressOfTech(data, tech.stopId, tech.technicianId);
  const herePing = pingCoords(
    hereProgress,
    tech.phase === "en_transito" ? "leave" : "arrive",
  );
  const here = herePing ?? coordsOfStop(data, hereStop);
  const next = coordsOfStop(data, nextStop);

  if (tech.phase === "en_transito" && here && next) {
    const left = data.progress.find(
      (p) =>
        p.stopId === tech.stopId &&
        p.technicianId === tech.technicianId &&
        p.leftAtMs,
    );
    const elapsed = left?.leftAtMs
      ? (nowMs - left.leftAtMs) / 3600000
      : 0.4;
    return lerp(here, next, elapsed);
  }
  if (here) return here;
  if (next) return next;
  return coordsById(data, "loc-base");
}

function offsetStacked(lat: number, lng: number, index: number, total: number) {
  if (total <= 1) return [lat, lng] as [number, number];
  const angle = (index / total) * Math.PI * 2;
  const d = 0.00018;
  return [lat + Math.cos(angle) * d, lng + Math.sin(angle) * d * 1.15] as [
    number,
    number,
  ];
}

export function livePins(
  data: AppData,
  rows: RouteLive[],
  nowMs: number,
): MapPin[] {
  const raw = rows
    .filter((row) => row.phase !== "cerrada")
    .flatMap((row) =>
      row.techs.map((tech) => {
        const point = pointForTech(data, tech, nowMs);
        if (!point) return null;
        const techName =
          data.technicians.find((t) => t.id === tech.technicianId)?.name ??
          tech.technicianId;
        const placeStop = stopOf(
          data,
          tech.phase === "en_transito" ? tech.nextStopId : tech.stopId,
        );
        const place = placeStop
          ? (placeStop.city?.trim() ||
            data.locations.find((l) => l.id === placeStop.locationId)?.name ||
            "En ruta")
          : "En ruta";
        return {
          id: `${row.route.id}-${tech.technicianId}`,
          lat: point[0],
          lng: point[1],
          label: techName,
          detail: `${PHASE_LABEL[tech.phase]} · ${place} · ${row.route.id}`,
          phase: tech.phase,
          gps: formatGps(point[0], point[1]),
        } satisfies MapPin;
      }),
    )
    .filter((pin): pin is MapPin => Boolean(pin));

  const groups = new Map<string, MapPin[]>();
  for (const pin of raw) {
    const key = `${pin.lat.toFixed(3)}:${pin.lng.toFixed(3)}`;
    const list = groups.get(key) ?? [];
    list.push(pin);
    groups.set(key, list);
  }

  return [...groups.values()].flatMap((group) =>
    group.map((pin, i) => {
      const [lat, lng] = offsetStacked(pin.lat, pin.lng, i, group.length);
      return {
        ...pin,
        lat,
        lng,
      };
    }),
  );
}

export function withLocationCoords(location: Location): Location {
  if (location.id === BASE_LOCATION_ID) {
    return {
      ...location,
      name: "INACAP Santiago Sur (base)",
      lat: BASE_COORDS.lat,
      lng: BASE_COORDS.lng,
    };
  }
  const coords = coordsOf(location);
  if (!coords) return location;
  return { ...location, lat: coords[0], lng: coords[1] };
}
