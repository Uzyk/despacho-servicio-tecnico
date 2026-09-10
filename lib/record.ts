import {
  allowancesOf,
  routeHasOvernight,
  totalAllowances,
} from "./allowances";
import { hoursForStops } from "./hours";
import type { AppData, LogEvent, LogKind } from "./types";

export type ChartBar = {
  label: string;
  value: number;
};

export type ChartSlice = {
  label: string;
  value: number;
  color: string;
};

export function isRouteOpen(route: { status?: string; closedAt?: number }) {
  if (route.status === "finalizada" || route.closedAt) return false;
  return route.status === "abierta";
}

export function techAssignedRoutes(data: AppData, technicianId: string) {
  const ids = new Set(
    data.assignments
      .filter((a) => a.technicianId === technicianId)
      .map((a) => a.routeId),
  );
  return data.routes
    .filter((r) => ids.has(r.id))
    .sort((a, b) => {
      const openA = isRouteOpen(a) ? 0 : 1;
      const openB = isRouteOpen(b) ? 0 : 1;
      if (openA !== openB) return openA - openB;
      return (b.closedAt ?? 0) - (a.closedAt ?? 0) || a.id.localeCompare(b.id);
    });
}

export function techOpenRoutes(data: AppData, technicianId: string) {
  const archived = new Set(
    (data.events ?? [])
      .filter((e) => e.kind === "ruta_cerrada")
      .map((e) => e.routeId),
  );
  return data.assignments
    .filter((a) => a.technicianId === technicianId)
    .map((a) => data.routes.find((r) => r.id === a.routeId))
    .filter((r): r is NonNullable<typeof r> =>
      Boolean(r && isRouteOpen(r) && !archived.has(r.id)),
    );
}

export function assignmentOf(
  data: AppData,
  routeId: string,
  technicianId: string,
) {
  return data.assignments.find(
    (a) => a.routeId === routeId && a.technicianId === technicianId,
  );
}

export function hasAckedRoute(
  data: AppData,
  routeId: string,
  technicianId: string,
) {
  const row = assignmentOf(data, routeId, technicianId);
  if (row?.seenAt) return true;
  return (data.progress ?? []).some(
    (p) =>
      p.technicianId === technicianId &&
      Boolean(p.arrivedAt) &&
      data.stops.some((s) => s.id === p.stopId && s.routeId === routeId),
  );
}

export function pendingAcks(data: AppData, routeId: string) {
  return data.assignments.filter(
    (a) => a.routeId === routeId && !hasAckedRoute(data, routeId, a.technicianId),
  );
}

export function crewIds(data: AppData, routeId: string, leadId?: string) {
  const ids = new Set<string>();
  if (leadId) ids.add(leadId);
  const route = data.routes.find((r) => r.id === routeId);
  if (route?.leadId) ids.add(route.leadId);
  for (const a of data.assignments.filter((x) => x.routeId === routeId)) {
    ids.add(a.technicianId);
  }
  return [...ids];
}

export function routeVehicleId(data: AppData, routeId: string) {
  const route = data.routes.find((r) => r.id === routeId);
  if (route?.vehicleId) return route.vehicleId;
  return (
    data.assignments.find((a) => a.routeId === routeId)?.vehicleId ??
    ""
  );
}

export function routePayout(data: AppData, routeId: string) {
  const route = data.routes.find((r) => r.id === routeId);
  if (!route) return 0;
  const crew = Math.max(crewIds(data, routeId).length, 1);
  return totalAllowances(
    allowancesOf(data, route),
    crew,
    routeHasOvernight(data, routeId),
  );
}

export function openRoutes(data: AppData) {
  return data.routes.filter(isRouteOpen);
}

export function finishedRoutes(data: AppData) {
  return data.routes
    .filter((r) => r.status === "finalizada")
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
}

export const EVENT_LABEL: Record<LogKind, string> = {
  asignado: "Asignado",
  baja: "Baja / no pudo ir",
  entra: "Entró de reemplazo",
  visto: "Vio la ruta",
  llegada: "Llegada",
  salida: "Salida de trabajo",
  ruta_cerrada: "Ruta finalizada",
};

export type TechStats = {
  technicianId: string;
  assigned: number;
  finished: number;
  bajas: number;
  cubrio: number;
  arrivals: number;
  minutes: number;
  events: LogEvent[];
};

export function eventsOf(data: AppData, technicianId: string) {
  return (data.events ?? [])
    .filter((e) => e.technicianId === technicianId)
    .sort((a, b) => b.at - a.at);
}

export function techStats(data: AppData, technicianId: string): TechStats {
  const events = eventsOf(data, technicianId);
  const assigned = new Set(
    [
      ...events
        .filter((e) => e.kind === "asignado" || e.kind === "entra")
        .map((e) => e.routeId),
      ...data.assignments
        .filter((a) => a.technicianId === technicianId)
        .map((a) => a.routeId),
    ].filter(Boolean),
  ).size;
  const minutes = hoursForStops(data.stops, data.progress ?? [], technicianId).reduce(
    (sum, row) => sum + row.minutes,
    0,
  );
  return {
    technicianId,
    assigned,
    finished: events.filter((e) => e.kind === "ruta_cerrada").length,
    bajas: events.filter((e) => e.kind === "baja").length,
    cubrio: events.filter((e) => e.kind === "entra").length,
    arrivals: events.filter((e) => e.kind === "llegada").length,
    minutes,
    events,
  };
}

export function allTechStats(data: AppData) {
  return data.technicians
    .map((t) => techStats(data, t.id))
    .sort((a, b) => b.finished - a.finished || b.assigned - a.assigned);
}

export function activityBars(stats: TechStats): ChartBar[] {
  return [
    { label: "Rutas", value: stats.assigned },
    { label: "Finalizó", value: stats.finished },
    { label: "Bajas", value: stats.bajas },
    { label: "Cubrió", value: stats.cubrio },
    { label: "Llegadas", value: stats.arrivals },
  ];
}

export function fulfillmentSlices(stats: TechStats): ChartSlice[] {
  const pending = Math.max(stats.assigned - stats.finished, 0);
  return [
    { label: "Finalizó", value: stats.finished, color: "#0f3a5f" },
    { label: "Pendiente", value: pending, color: "#c9a227" },
    { label: "Bajas", value: stats.bajas, color: "#b45309" },
  ];
}

export function hoursByLocation(data: AppData, technicianId: string): ChartBar[] {
  const names = new Map(data.locations.map((l) => [l.id, l.name]));
  const totals = new Map<string, number>();
  for (const row of hoursForStops(data.stops, data.progress ?? [], technicianId)) {
    if (row.minutes <= 0) continue;
    const name =
      row.stop.city?.trim() ||
      names.get(row.stop.locationId) ||
      row.stop.locationId;
    totals.set(name, (totals.get(name) ?? 0) + row.minutes);
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function eventsByDay(events: LogEvent[]): ChartBar[] {
  const totals = new Map<string, number>();
  for (const event of [...events].sort((a, b) => a.at - b.at)) {
    const key = new Date(event.at).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
    });
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .slice(-8);
}

export function formatWhen(at: number) {
  return new Date(at).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
