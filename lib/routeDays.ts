import {
  formatDayPretty,
  formatRouteWhen,
  isImmediatePriorDate,
  routeDate,
} from "./calendar";
import { isRouteOpen, openRoutes } from "./record";
import type { AppData, Route, Stop } from "./types";

export function stopDate(stop: Stop, route: Route) {
  return stop.date ?? routeDate(route);
}

export function routeDates(data: AppData, route: Route) {
  const dates = new Set<string>();
  dates.add(routeDate(route));
  for (const stop of data.stops.filter((s) => s.routeId === route.id)) {
    dates.add(stopDate(stop, route));
  }
  for (const rest of route.restDates ?? []) dates.add(rest);
  return [...dates].sort();
}

export function routeLastDate(data: AppData, route: Route) {
  const dates = routeDates(data, route);
  return dates[dates.length - 1] ?? routeDate(route);
}

export function hasActivityOn(data: AppData, route: Route, date: string) {
  return routeDates(data, route).includes(date);
}

export function companionsOnDate(
  data: AppData,
  technicianId: string,
  date: string,
) {
  return data.assignments.filter((row) => {
    if (row.technicianId === technicianId) return false;
    const route = data.routes.find((r) => r.id === row.routeId);
    if (!route) return false;
    const sharesRoute = data.assignments.some(
      (a) => a.routeId === route.id && a.technicianId === technicianId,
    );
    return sharesRoute && hasActivityOn(data, route, date);
  });
}

export function isRestDay(route: Route, date: string) {
  return (route.restDates ?? []).includes(date);
}

export function workStopsOnDate(data: AppData, route: Route, date: string) {
  return data.stops.filter(
    (s) => s.routeId === route.id && stopDate(s, route) === date,
  );
}

export function sameDayOpenRoutes(data: AppData, date: string) {
  return openRoutes(data).filter((r) => hasActivityOn(data, r, date));
}

export function continuableOpenRoutes(data: AppData, date: string) {
  return openRoutes(data).filter((r) => {
    if (hasActivityOn(data, r, date)) return false;
    return isImmediatePriorDate(date, routeLastDate(data, r));
  });
}

export function selectableOpenRoute(
  data: AppData,
  routeId: string,
  date: string,
) {
  if (!routeId) return undefined;
  return (
    sameDayOpenRoutes(data, date).find((r) => r.id === routeId) ??
    continuableOpenRoutes(data, date).find((r) => r.id === routeId)
  );
}

export function formatRouteSpan(data: AppData, route: Route) {
  const dates = routeDates(data, route);
  if (dates.length <= 1) return formatRouteWhen(route);
  return `${formatDayPretty(dates[0])} – ${formatDayPretty(dates[dates.length - 1])}`;
}

export function routesByActivityDate(data: AppData, technicianId?: string) {
  const map = new Map<string, Route[]>();
  const routes = technicianId
    ? data.routes.filter((route) =>
        data.assignments.some(
          (a) => a.routeId === route.id && a.technicianId === technicianId,
        ),
      )
    : data.routes;
  for (const route of routes) {
    for (const iso of routeDates(data, route)) {
      const list = map.get(iso) ?? [];
      list.push(route);
      map.set(iso, list);
    }
  }
  return map;
}

export function canRestOn(data: AppData, route: Route, date: string) {
  if (!isRouteOpen(route)) return false;
  if (workStopsOnDate(data, route, date).length > 0) return false;
  if (isRestDay(route, date)) return true;
  const last = routeLastDate(data, route);
  return last === date || isImmediatePriorDate(date, last);
}
