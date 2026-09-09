import { formatHours, subClock } from "./hours";
import { BASE_COORDS, BASE_LABEL, BASE_LOCATION_ID, coordsById, coordsOf } from "./geo";
import { installAddressOf, timeIsDeparture } from "./install";
import { lodgingPlace } from "./lodging";
import type { AppData, Route, Stop } from "./types";

export type EtaPoint = {
  label: string;
  query: string;
  lat?: number;
  lng?: number;
};

export type EtaResult = {
  leaveAt: string;
  etaAt?: string;
  minutes: number;
  km: number;
  destLat?: number;
  destLng?: number;
  via: "ruta" | "estimado";
};

export const BASE_POINT: EtaPoint = {
  label: `${BASE_LABEL} (base)`,
  query: "Av. Vicuña Mackenna 3864, Macul, Santiago, Chile",
  lat: BASE_COORDS.lat,
  lng: BASE_COORDS.lng,
};

export function formatEta(
  result: EtaResult,
  mode: "leave" | "arrive" = "leave",
) {
  const clock =
    mode === "arrive" && result.etaAt ? result.etaAt : result.leaveAt;
  const prefix = mode === "arrive" ? "Llegada est." : "Salir est.";
  return `${prefix} ${clock} · ${formatHours(result.minutes)} · ${Math.round(result.km)} km`;
}

export function stopDestPoint(data: AppData, stop: Stop): EtaPoint {
  const loc = data.locations.find((l) => l.id === stop.locationId);
  const city = stop.city?.trim() || loc?.name || "Chile";
  const address = lodgingPlace(stop) || installAddressOf(stop);
  const coords =
    stop.destLat != null && stop.destLng != null
      ? ([stop.destLat, stop.destLng] as [number, number])
      : loc
        ? coordsOf(loc)
        : null;
  return {
    label: address || city,
    query: address ? `${address}, ${city}, Chile` : `${city}, Chile`,
    lat: coords?.[0],
    lng: coords?.[1],
  };
}

export function lastWorkOrigin(
  data: AppData,
  route?: Route | null,
): EtaPoint | null {
  if (!route) return null;
  const last = data.stops
    .filter((s) => s.routeId === route.id)
    .sort((a, b) => a.order - b.order)
    .slice()
    .reverse()
    .find(
      (s) =>
        s.locationId !== BASE_LOCATION_ID && s.workType !== "Regreso a base",
    );
  if (!last) return null;
  const point = stopDestPoint(data, last);
  const city =
    last.city?.trim() ||
    data.locations.find((l) => l.id === last.locationId)?.name ||
    last.locationId;
  return {
    ...point,
    label: `${city} (última locación)`,
  };
}

export function originForRoute(data: AppData, route?: Route | null): EtaPoint {
  if (!route) return BASE_POINT;
  const last = data.stops
    .filter((s) => s.routeId === route.id)
    .sort((a, b) => a.order - b.order)
    .at(-1);
  if (!last) {
    return coordsById(data, "loc-base")
      ? { ...BASE_POINT, lat: coordsById(data, "loc-base")![0], lng: coordsById(data, "loc-base")![1] }
      : BASE_POINT;
  }
  const point = stopDestPoint(data, last);
  return {
    ...point,
    label: `${last.city?.trim() || data.locations.find((l) => l.id === last.locationId)?.name || last.locationId} (parada ${last.order})`,
  };
}

export function destForDraft(
  data: AppData,
  input: {
    locationId: string;
    lodgingPlan?: string;
    installAddress?: string;
    city?: string;
    lat?: number;
    lng?: number;
  },
): EtaPoint {
  const loc = data.locations.find((l) => l.id === input.locationId);
  const city = input.city?.trim() || loc?.name || "Chile";
  const address = (input.lodgingPlan || input.installAddress || "").trim();
  const coords = loc ? coordsOf(loc) : null;
  return {
    label: address || city,
    query: address ? `${address}, ${city}, Chile` : `${city}, Chile`,
    lat: input.lat ?? (address ? undefined : coords?.[0]),
    lng: input.lng ?? (address ? undefined : coords?.[1]),
  };
}

export function applyArrive(
  arrive: string,
  minutes: number,
): Pick<EtaResult, "leaveAt" | "minutes"> {
  return { leaveAt: subClock(arrive, minutes), minutes };
}

export function stopClockHint(stop: Stop) {
  const hasTravel =
    stop.travelMinutes != null &&
    stop.travelKm != null &&
    Boolean(stop.leaveAt || stop.etaAt);

  if (timeIsDeparture(stop.workType)) {
    const parts: string[] = [];
    if (stop.time) parts.push(`Salir ${stop.time}`);
    if (hasTravel) {
      parts.push(
        formatEta(
          {
            leaveAt: stop.leaveAt ?? stop.time ?? "",
            etaAt: stop.etaAt,
            minutes: stop.travelMinutes ?? 0,
            km: stop.travelKm ?? 0,
            via: "ruta",
          },
          "arrive",
        ),
      );
    } else if (stop.etaAt) {
      parts.push(`Llegada est. ${stop.etaAt}`);
    }
    return parts.length ? parts.join(" · ") : "";
  }

  const parts: string[] = [];
  if (hasTravel) {
    parts.push(
      formatEta({
        leaveAt: stop.leaveAt ?? "",
        etaAt: stop.etaAt,
        minutes: stop.travelMinutes ?? 0,
        km: stop.travelKm ?? 0,
        via: "ruta",
      }),
    );
  } else if (stop.leaveAt) {
    parts.push(`Salir est. ${stop.leaveAt}`);
  }
  if (stop.time) parts.push(`estar ${stop.time}`);
  return parts.length ? parts.join(" · ") : "";
}
