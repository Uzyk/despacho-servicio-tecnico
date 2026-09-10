import { formatHours, subClock } from "./hours";
import { BASE_COORDS, BASE_LABEL, BASE_LOCATION_ID, coordsOf, haversineKm } from "./geo";
import { installAddressOf, isReturnToBase, timeIsDeparture } from "./install";
import { lodgingPlace } from "./lodging";
import { stopDate } from "./routeDays";
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

function nearBase(lat?: number, lng?: number) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return false;
  }
  return haversineKm({ lat, lng }, BASE_COORDS) < 40;
}

export function stopDestPoint(data: AppData, stop: Stop): EtaPoint {
  const loc = data.locations.find((l) => l.id === stop.locationId);
  const city = stop.city?.trim() || loc?.name || "Chile";
  const address = lodgingPlace(stop) || installAddressOf(stop);
  const locCoords = loc ? coordsOf(loc) : null;
  const stored =
    stop.destLat != null && stop.destLng != null
      ? ([stop.destLat, stop.destLng] as [number, number])
      : null;
  const field = isFieldStop(stop);
  const storedOk = Boolean(stored && !(field && nearBase(stored[0], stored[1])));
  const coords = storedOk ? stored : locCoords;
  return {
    label: address || city,
    query: address ? `${address}, ${city}, Chile` : `${city}, Chile`,
    lat: coords?.[0],
    lng: coords?.[1],
  };
}

function stopsOfRoute(data: AppData, route: Route) {
  return data.stops
    .filter((s) => s.routeId === route.id)
    .sort((a, b) => {
      const byDate = stopDate(a, route).localeCompare(stopDate(b, route));
      return byDate || a.order - b.order;
    });
}

function isFieldStop(stop: Stop) {
  return stop.locationId !== BASE_LOCATION_ID && !isReturnToBase(stop.workType);
}

function labeledFieldOrigin(data: AppData, stop: Stop): EtaPoint {
  const point = stopDestPoint(data, stop);
  const city =
    stop.city?.trim() ||
    data.locations.find((l) => l.id === stop.locationId)?.name ||
    stop.locationId;
  return {
    ...point,
    label: `${city} (última locación)`,
  };
}

export function lastFieldStop(
  data: AppData,
  route?: Route | null,
  asOfDate?: string,
): Stop | undefined {
  if (!route) return undefined;
  const stops = stopsOfRoute(data, route);
  const relevant = asOfDate
    ? stops.filter((s) => stopDate(s, route) <= asOfDate)
    : stops;
  return [...relevant].reverse().find(isFieldStop);
}

export function lastWorkOrigin(
  data: AppData,
  route?: Route | null,
  asOfDate?: string,
): EtaPoint | null {
  const last = lastFieldStop(data, route, asOfDate);
  return last ? labeledFieldOrigin(data, last) : null;
}

export function originForRoute(
  data: AppData,
  route?: Route | null,
  asOfDate?: string,
): EtaPoint {
  return lastWorkOrigin(data, route, asOfDate) ?? BASE_POINT;
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
  const locIsField = Boolean(loc && loc.id !== BASE_LOCATION_ID);
  const pinLat =
    locIsField && nearBase(input.lat, input.lng) ? undefined : input.lat;
  const pinLng =
    locIsField && nearBase(input.lat, input.lng) ? undefined : input.lng;
  return {
    label: address || city,
    query: address ? `${address}, ${city}, Chile` : `${city}, Chile`,
    lat: pinLat ?? (address ? undefined : coords?.[0]),
    lng: pinLng ?? (address ? undefined : coords?.[1]),
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
