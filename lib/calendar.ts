import type { Day, Route } from "./types";

const JS_TO_DAY: Record<number, Day> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

const DAY_TO_JS: Record<Day, number> = {
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
};

export function isoDate(value: Date = new Date()) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function dayFromIso(iso: string): Day | null {
  return JS_TO_DAY[parseIso(iso).getDay()] ?? null;
}

export function upcomingWeekday(day: Day, from: Date = new Date()) {
  const candidate = parseIso(dateOfWeekday(day, from));
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (candidate < today) candidate.setDate(candidate.getDate() + 7);
  return isoDate(candidate);
}

export function dateOfWeekday(day: Day, from: Date = new Date()) {
  const current = from.getDay();
  const mondayOffset = current === 0 ? -6 : 1 - current;
  const monday = new Date(from.getFullYear(), from.getMonth(), from.getDate() + mondayOffset);
  const result = new Date(monday);
  result.setDate(monday.getDate() + (DAY_TO_JS[day] - 1));
  return isoDate(result);
}

export function weekdayLabel(iso: string) {
  return (
    parseIso(iso).toLocaleDateString("es-CL", { weekday: "long" })
  );
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function currentMonthKey(from: Date = new Date()) {
  return monthKey(isoDate(from));
}

export function monthKeyTitle(key: string) {
  const [y, m] = key.split("-").map(Number);
  return monthTitle(y, (m ?? 1) - 1);
}

export function shiftMonthKey(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const next = new Date(y, (m ?? 1) - 1 + delta, 1);
  return monthKey(isoDate(next));
}

export function monthTitle(year: number, month: number) {
  const raw = new Date(year, month, 1).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { iso: string; inMonth: boolean; dayNum: number }[] = [];

  for (let i = 0; i < startPad; i += 1) {
    const date = new Date(year, month, 1 - startPad + i);
    cells.push({ iso: isoDate(date), inMonth: false, dayNum: date.getDate() });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = new Date(year, month, d);
    cells.push({ iso: isoDate(date), inMonth: true, dayNum: d });
  }
  let extra = 1;
  while (cells.length % 7 !== 0) {
    const date = new Date(year, month + 1, extra);
    cells.push({ iso: isoDate(date), inMonth: false, dayNum: date.getDate() });
    extra += 1;
  }
  return cells;
}

export function nearestWorkday(iso: string) {
  const value = parseIso(iso);
  const dow = value.getDay();
  if (dow === 6) value.setDate(value.getDate() + 2);
  if (dow === 0) value.setDate(value.getDate() + 1);
  return isoDate(value);
}

export function shiftIso(iso: string, days: number) {
  const value = parseIso(iso);
  value.setDate(value.getDate() + days);
  return isoDate(value);
}

export function previousWorkday(iso: string) {
  const value = parseIso(iso);
  do {
    value.setDate(value.getDate() - 1);
  } while (value.getDay() === 0 || value.getDay() === 6);
  return isoDate(value);
}

export function daysBetween(from: string, to: string) {
  const ms = parseIso(to).getTime() - parseIso(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatDayPretty(iso: string) {
  return parseIso(iso).toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function isImmediatePriorDate(selected: string, prior: string) {
  if (prior >= selected) return false;
  if (daysBetween(prior, selected) > 3) return false;
  return prior === shiftIso(selected, -1) || prior === previousWorkday(selected);
}

export function routeDate(route: Route) {
  return route.date ?? dateOfWeekday(route.day);
}

export function formatRouteWhen(route: Route) {
  const pretty = parseIso(routeDate(route)).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
  });
  return `${route.day} ${pretty}`;
}
