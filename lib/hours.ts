import type { Stop, StopProgress, WorkType } from "./types";

export function clockNow(at: Date = new Date()): string {
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

export function stampNow(at: Date = new Date()) {
  return { time: clockNow(at), ms: at.getTime() };
}

export function stopAssignees(stop: Stop): string[] {
  if (stop.assigneeIds?.length) return stop.assigneeIds;
  if (stop.assigneeId) return [stop.assigneeId];
  return [];
}

export function isStopAssignedTo(stop: Stop, technicianId: string) {
  const ids = stopAssignees(stop);
  if (ids.length) return ids.includes(technicianId);
  return isLocationPing(stop.workType);
}

export function stopsForTech(stops: Stop[], routeId: string, technicianId: string) {
  return stops
    .filter((s) => s.routeId === routeId && isStopAssignedTo(s, technicianId))
    .sort((a, b) => a.order - b.order);
}

export function priorStop(stops: Stop[], stop: Stop, technicianId?: string) {
  if (!technicianId) {
    return stops.find((s) => s.routeId === stop.routeId && s.order === stop.order - 1);
  }
  const mine = stopsForTech(stops, stop.routeId, technicianId);
  const index = mine.findIndex((s) => s.id === stop.id);
  return index > 0 ? mine[index - 1] : undefined;
}

export function addClock(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  if ([h, m].some((n) => Number.isNaN(n))) return "";
  const total = ((h * 60 + m + Math.max(0, Math.round(minutes))) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function subClock(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  if ([h, m].some((n) => Number.isNaN(n))) return "";
  const total =
    ((h * 60 + m - Math.max(0, Math.round(minutes))) % (24 * 60) + 24 * 60) %
    (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function minutesBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

export function formatHours(mins: number): string {
  if (mins <= 0) return "0 h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function isLocationPing(workType: WorkType) {
  return (
    workType === "Traslado" ||
    workType === "Pernocte" ||
    workType === "Traslado y pernocte" ||
    workType === "Regreso a base"
  );
}

export function isStopDone(stop: Stop, p?: StopProgress | null) {
  if (isLocationPing(stop.workType)) return Boolean(p?.arrivedAt);
  return Boolean(p?.leftAt);
}

export function stayMinutes(p?: StopProgress | null): number {
  if (p?.arrivedAtMs && p.leftAtMs && p.leftAtMs >= p.arrivedAtMs) {
    return Math.round((p.leftAtMs - p.arrivedAtMs) / 60000);
  }
  if (!p?.arrivedAt || !p.leftAt) return 0;
  return minutesBetween(p.arrivedAt, p.leftAt);
}

export function tasksForWorkType(workType: WorkType): string[] {
  switch (workType) {
    case "Traslado":
    case "Pernocte":
    case "Traslado y pernocte":
    case "Regreso a base":
      return [];
    case "Despacho":
      return ["Entregar producto o materiales"];
    case "Instalación":
      return ["Instalación del equipo"];
    case "Capacitación":
      return ["Capacitación al cliente"];
    case "Instalación y capacitación":
      return ["Instalación del equipo", "Capacitación al cliente"];
    default:
      return ["Trabajo en locación"];
  }
}

export function progressOf(
  list: StopProgress[],
  stopId: string,
  technicianId: string,
) {
  return list.find((p) => p.stopId === stopId && p.technicianId === technicianId);
}

export function hoursForStops(
  stops: Stop[],
  progress: StopProgress[],
  technicianId: string,
) {
  return stops.map((stop) => {
    const p = progressOf(progress, stop.id, technicianId);
    const mine = isStopAssignedTo(stop, technicianId);
    return {
      stop,
      progress: p,
      minutes: !mine || isLocationPing(stop.workType) ? 0 : stayMinutes(p),
    };
  });
}
