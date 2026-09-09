import type { AppData, Day } from "./types";

export function nextTechnicianCode(data: AppData): string {
  const nums = data.technicians.map((t) => {
    const m = t.id.match(/T(\d+)/);
    return m ? Number(m[1]) : 0;
  });
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `T${String(next).padStart(2, "0")}`;
}

export function nextRouteId(data: AppData): string {
  const nums = data.routes.map((r) => {
    const m = r.id.match(/R-(\d+)/);
    return m ? Number(m[1]) : 0;
  });
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `R-${String(next).padStart(3, "0")}`;
}

export function findOrCreateRouteId(
  data: AppData,
  _day: Day,
  _date?: string,
  routeId?: string,
): { routeId: string; created: boolean } {
  if (routeId) {
    const existing = data.routes.find(
      (r) => r.id === routeId && r.status === "abierta",
    );
    if (existing) return { routeId: existing.id, created: false };
  }
  return { routeId: nextRouteId(data), created: true };
}

export function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function money(n: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}
