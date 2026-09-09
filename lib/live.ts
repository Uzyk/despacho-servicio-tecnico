import {
  isLocationPing,
  isStopAssignedTo,
  isStopDone,
  progressOf,
  stayMinutes,
} from "./hours";
import { needsLodging } from "./lodging";
import { isRouteOpen } from "./record";
import type { AppData, Assignment, Route, Stop, StopProgress } from "./types";

export type RoutePhase = "pendiente" | "en_curso" | "cerrada";
export type TechPhase =
  | "sin_iniciar"
  | "en_locacion"
  | "llego"
  | "pernocta"
  | "en_transito"
  | "terminada";

export type TechLive = {
  technicianId: string;
  vehicleId: string;
  phase: TechPhase;
  stopId?: string;
  nextStopId?: string;
  arrivedAt?: string;
  tasksDone: number;
  tasksTotal: number;
  minutes: number;
};

export type RouteLive = {
  route: Route;
  phase: RoutePhase;
  techs: TechLive[];
  stops: Stop[];
};

function elapsedMinutes(p: StopProgress | undefined, nowMs: number): number {
  if (!p?.arrivedAt || p.leftAt) return 0;
  if (p.arrivedAtMs) {
    return Math.max(0, Math.round((nowMs - p.arrivedAtMs) / 60000));
  }
  return 0;
}

function taskCounts(p?: StopProgress) {
  const tasks = p?.tasks ?? [];
  return {
    tasksDone: tasks.filter((t) => t.done).length,
    tasksTotal: tasks.length,
  };
}

function workMinutes(stops: Stop[], rows: (StopProgress | undefined)[], nowMs: number) {
  return stops.reduce((sum, stop, i) => {
    if (isLocationPing(stop.workType)) return sum;
    const p = rows[i];
    return sum + stayMinutes(p) + elapsedMinutes(p, nowMs);
  }, 0);
}

export function techLive(
  stops: Stop[],
  progress: StopProgress[],
  assignment: Assignment,
  nowMs: number,
): TechLive {
  const ordered = [...stops]
    .filter((s) => isStopAssignedTo(s, assignment.technicianId))
    .sort((a, b) => a.order - b.order);
  const rows = ordered.map((stop) =>
    progressOf(progress, stop.id, assignment.technicianId),
  );
  const minutes = workMinutes(ordered, rows, nowMs);
  const base = {
    technicianId: assignment.technicianId,
    vehicleId: assignment.vehicleId,
    minutes,
  };

  if (ordered.length === 0) {
    return {
      ...base,
      phase: "sin_iniciar",
      tasksDone: 0,
      tasksTotal: 0,
    };
  }

  if (ordered.every((stop, i) => isStopDone(stop, rows[i]))) {
    return {
      ...base,
      phase: "terminada",
      stopId: ordered[ordered.length - 1]?.id,
      ...taskCounts(rows[rows.length - 1]),
    };
  }

  const workOpen = ordered.findIndex(
    (stop, i) =>
      !isLocationPing(stop.workType) && rows[i]?.arrivedAt && !rows[i]?.leftAt,
  );
  if (workOpen >= 0) {
    const p = rows[workOpen];
    return {
      ...base,
      phase: "en_locacion",
      stopId: ordered[workOpen].id,
      arrivedAt: p?.arrivedAt,
      ...taskCounts(p),
    };
  }

  const started = rows.some((p) => p?.arrivedAt);
  if (!started) {
    return {
      ...base,
      phase: "sin_iniciar",
      nextStopId: ordered[0]?.id,
      tasksDone: 0,
      tasksTotal: 0,
    };
  }

  const lastArrived = [...ordered]
    .map((stop, i) => ({ stop, p: rows[i] }))
    .reverse()
    .find((row) => row.p?.arrivedAt);
  const next = ordered.find((_, i) => !rows[i]?.arrivedAt);

  if (lastArrived && isLocationPing(lastArrived.stop.workType)) {
    return {
      ...base,
      phase: needsLodging(lastArrived.stop.workType) ? "pernocta" : "llego",
      stopId: lastArrived.stop.id,
      nextStopId: next?.id,
      arrivedAt: lastArrived.p?.arrivedAt,
      tasksDone: 0,
      tasksTotal: 0,
    };
  }

  const lastWorkLeft = [...ordered]
    .reverse()
    .find(
      (s) =>
        !isLocationPing(s.workType) &&
        progressOf(progress, s.id, assignment.technicianId)?.leftAt,
    );

  return {
    ...base,
    phase: "en_transito",
    stopId: lastWorkLeft?.id,
    nextStopId: next?.id,
    tasksDone: 0,
    tasksTotal: 0,
  };
}

export function routeLive(
  data: AppData,
  route: Route,
  nowMs: number,
): RouteLive | null {
  const assigns = data.assignments.filter((a) => a.routeId === route.id);
  if (assigns.length === 0) return null;
  const stops = data.stops
    .filter((s) => s.routeId === route.id)
    .sort((a, b) => a.order - b.order);
  const techs = assigns.map((a) =>
    techLive(stops, data.progress ?? [], a, nowMs),
  );
  const phase: RoutePhase = techs.every((t) => t.phase === "terminada")
    ? "cerrada"
    : techs.every((t) => t.phase === "sin_iniciar")
      ? "pendiente"
      : "en_curso";
  return { route, phase, techs, stops };
}

export function liveRoutes(data: AppData, nowMs: number): RouteLive[] {
  return data.routes
    .filter(isRouteOpen)
    .map((route) => routeLive(data, route, nowMs))
    .filter((row): row is RouteLive => Boolean(row))
    .sort((a, b) => {
      const rank = { en_curso: 0, pendiente: 1, cerrada: 2 };
      return rank[a.phase] - rank[b.phase] || a.route.id.localeCompare(b.route.id);
    });
}

export const PHASE_LABEL: Record<TechPhase, string> = {
  sin_iniciar: "Sin iniciar",
  en_locacion: "Trabajando",
  llego: "Llegó bien",
  pernocta: "Pernocta",
  en_transito: "En tránsito",
  terminada: "Terminó",
};

export const ROUTE_PHASE_LABEL: Record<RoutePhase, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  cerrada: "Cerrada",
};
