import { routeDate } from "./calendar";
import {
  BASE_COORDS,
  BASE_LOCATION_ID,
  coordsOfStop,
  kmBetween,
} from "./geo";
import { isReturnToBase } from "./install";
import { isRouteOpen, techOpenRoutes } from "./record";
import { routeDates, stopDate } from "./routeDays";
import type { AppData, Route, Stop } from "./types";

const HOME_RADIUS_KM = 180;
const FIELD_NEAR_KM = 220;

function homePoint(): [number, number] {
  return [BASE_COORDS.lat, BASE_COORDS.lng];
}

function isHome(coords: [number, number]) {
  return kmBetween(coords, homePoint()) <= HOME_RADIUS_KM;
}

function stopsOf(data: AppData, route: Route) {
  return data.stops
    .filter((s) => s.routeId === route.id)
    .sort((a, b) => {
      const byDate = stopDate(a, route).localeCompare(stopDate(b, route));
      return byDate || a.order - b.order;
    });
}

export function routeWorkPoint(data: AppData, route: Route): [number, number] {
  const stops = stopsOf(data, route);
  const field = stops.find(
    (s) =>
      s.locationId !== BASE_LOCATION_ID && !isReturnToBase(s.workType),
  );
  return coordsOfStop(data, field ?? stops[0]) ?? homePoint();
}

export function techWhereabouts(
  data: AppData,
  technicianId: string,
  date: string,
  exceptRouteId?: string,
): { coords: [number, number]; atHome: boolean } {
  const rows: { date: string; order: number; stop: Stop }[] = [];
  for (const route of techOpenRoutes(data, technicianId)) {
    if (route.id === exceptRouteId) continue;
    for (const stop of data.stops.filter((s) => s.routeId === route.id)) {
      const day = stopDate(stop, route);
      if (day <= date) rows.push({ date: day, order: stop.order, stop });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const last = rows[rows.length - 1];
  if (
    !last ||
    isReturnToBase(last.stop.workType) ||
    last.stop.locationId === BASE_LOCATION_ID
  ) {
    return { coords: homePoint(), atHome: true };
  }
  const coords = coordsOfStop(data, last.stop) ?? homePoint();
  return { coords, atHome: isHome(coords) };
}

export function techOccupiedOn(
  data: AppData,
  technicianId: string,
  date: string,
  exceptRouteId?: string,
) {
  return techOpenRoutes(data, technicianId).some((route) => {
    if (route.id === exceptRouteId) return false;
    const dates = routeDates(data, route);
    if (dates.length === 0) return false;
    return date >= dates[0] && date <= dates[dates.length - 1];
  });
}

export function isFreeForRoute(
  data: AppData,
  technicianId: string,
  routeId: string,
) {
  const tech = data.technicians.find((t) => t.id === technicianId);
  if (!tech?.active) return false;
  const route = data.routes.find((r) => r.id === routeId);
  if (!route || !isRouteOpen(route)) return false;
  if (
    data.assignments.some(
      (a) => a.routeId === routeId && a.technicianId === technicianId,
    )
  ) {
    return true;
  }
  const dates = routeDates(data, route);
  const window = dates.length > 0 ? dates : [routeDate(route)];
  if (
    window.some((day) => techOccupiedOn(data, technicianId, day, routeId))
  ) {
    return false;
  }
  const here = techWhereabouts(data, technicianId, window[0], routeId);
  if (here.atHome) return true;
  return kmBetween(here.coords, routeWorkPoint(data, route)) <= FIELD_NEAR_KM;
}

export function freeTechniciansForRoute(data: AppData, routeId: string) {
  return data.technicians.filter(
    (t) =>
      t.active &&
      isFreeForRoute(data, t.id, routeId) &&
      !data.assignments.some(
        (a) => a.routeId === routeId && a.technicianId === t.id,
      ),
  );
}

export function leadCandidatesForRoute(data: AppData, routeId: string) {
  return data.technicians.filter(
    (t) => t.active && isFreeForRoute(data, t.id, routeId),
  );
}
