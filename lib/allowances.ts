import { needsLodging } from "./lodging";
import type { AppData, Route, RouteAllowances } from "./types";

export const DEFAULT_BREAKFAST = 6000;
export const DEFAULT_LUNCH = 10000;
export const DEFAULT_DINNER = 8000;

export function emptyAllowances(lunch = DEFAULT_LUNCH): RouteAllowances {
  return {
    breakfast: 0,
    lunch,
    dinner: 0,
    tolls: 0,
    fuel: 0,
    hotel: 0,
  };
}

export function cleanAmount(value: number | undefined) {
  if (!Number.isFinite(value) || (value ?? 0) < 0) return 0;
  return Math.round(value ?? 0);
}

export function cleanAllowances(input?: Partial<RouteAllowances> | null): RouteAllowances {
  return {
    breakfast: cleanAmount(input?.breakfast),
    lunch: cleanAmount(input?.lunch) || DEFAULT_LUNCH,
    dinner: cleanAmount(input?.dinner),
    tolls: cleanAmount(input?.tolls),
    fuel: cleanAmount(input?.fuel),
    hotel: cleanAmount(input?.hotel),
  };
}

export function routeHasOvernight(data: AppData, routeId: string) {
  return data.stops.some(
    (s) => s.routeId === routeId && needsLodging(s.workType),
  );
}

export function allowancesOf(data: AppData, route: Route): RouteAllowances {
  const overnight = routeHasOvernight(data, route.id);
  const leadPay = data.assignments.find(
    (a) => a.routeId === route.id && a.technicianId === route.leadId,
  );
  const lunch =
    route.allowances?.lunch ?? leadPay?.perDiem ?? DEFAULT_LUNCH;
  const base = cleanAllowances({
    ...route.allowances,
    lunch,
  });
  if (!overnight) {
    return { ...base, breakfast: 0, dinner: 0, hotel: 0 };
  }
  return {
    ...base,
    breakfast: base.breakfast || DEFAULT_BREAKFAST,
    lunch: base.lunch || DEFAULT_LUNCH,
    dinner: base.dinner || DEFAULT_DINNER,
  };
}

export function withOvernightDefaults(
  allowances: RouteAllowances | undefined,
): RouteAllowances {
  const base = cleanAllowances(allowances);
  return {
    ...base,
    breakfast: base.breakfast || DEFAULT_BREAKFAST,
    lunch: base.lunch || DEFAULT_LUNCH,
    dinner: base.dinner || DEFAULT_DINNER,
  };
}

export function mealsPerPerson(allowances: RouteAllowances, overnight: boolean) {
  if (overnight) {
    return allowances.breakfast + allowances.lunch + allowances.dinner;
  }
  return allowances.lunch;
}

export function travelCosts(allowances: RouteAllowances) {
  return allowances.tolls + allowances.fuel + allowances.hotel;
}

export function totalAllowances(
  allowances: RouteAllowances,
  crewSize: number,
  overnight: boolean,
) {
  return mealsPerPerson(allowances, overnight) * Math.max(crewSize, 1) + travelCosts(allowances);
}

export function missingOvernightMeals(
  allowances: RouteAllowances,
  overnight: boolean,
) {
  if (!overnight) return [];
  const missing: string[] = [];
  if (allowances.breakfast <= 0) missing.push("desayuno");
  if (allowances.lunch <= 0) missing.push("almuerzo");
  if (allowances.dinner <= 0) missing.push("cena");
  return missing;
}

export function allowanceBreakdown(
  allowances: RouteAllowances,
  crewSize: number,
  overnight: boolean,
) {
  const people = Math.max(crewSize, 1);
  const rows: { label: string; amount: number }[] = [];
  if (overnight) {
    rows.push({ label: `Desayuno × ${people}`, amount: allowances.breakfast * people });
    rows.push({ label: `Almuerzo × ${people}`, amount: allowances.lunch * people });
    rows.push({ label: `Cena × ${people}`, amount: allowances.dinner * people });
    if (allowances.hotel > 0) {
      rows.push({ label: "Hotel", amount: allowances.hotel });
    }
  } else {
    rows.push({ label: `Almuerzo × ${people}`, amount: allowances.lunch * people });
  }
  if (allowances.tolls > 0) rows.push({ label: "Peajes", amount: allowances.tolls });
  if (allowances.fuel > 0) {
    rows.push({ label: "Combustible", amount: allowances.fuel });
  }
  return rows.filter((row) => row.amount > 0);
}
