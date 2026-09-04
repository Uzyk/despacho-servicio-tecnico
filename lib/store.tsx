"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { findOrCreateRouteId, uid } from "./ids";
import { SEED } from "./seed";
import type {
  AppData,
  Assignment,
  Day,
  Location,
  Stop,
  Technician,
  WorkType,
} from "./types";

const KEY = "despacho-inacap-v1";

type Store = {
  data: AppData;
  ready: boolean;
  reset: () => void;
  addTechnician: (name: string) => void;
  addLocation: (loc: Omit<Location, "id">) => void;
  addVehicle: (name: string, plate: string) => void;
  addStop: (input: {
    day: Day;
    leadId: string;
    locationId: string;
    workType: WorkType;
    time: string;
  }) => string;
  removeStop: (stopId: string) => void;
  assign: (input: Omit<Assignment, "id">) => void;
  removeAssignment: (id: string) => void;
};

const Ctx = createContext<Store | null>(null);

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(SEED);
    return JSON.parse(raw) as AppData;
  } catch {
    return structuredClone(SEED);
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(SEED);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(data));
  }, [data, ready]);

  const api = useMemo<Store>(
    () => ({
      data,
      ready,
      reset: () => setData(structuredClone(SEED)),
      addTechnician: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setData((d) => {
          const n = d.technicians.length + 1;
          const tech: Technician = {
            id: `T${String(n).padStart(2, "0")}`,
            name: trimmed,
            active: true,
          };
          return { ...d, technicians: [...d.technicians, tech] };
        });
      },
      addLocation: (loc) => {
        setData((d) => ({
          ...d,
          locations: [...d.locations, { ...loc, id: uid("loc") }],
        }));
      },
      addVehicle: (name, plate) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setData((d) => ({
          ...d,
          vehicles: [
            ...d.vehicles,
            { id: uid("v"), name: trimmed, plate: plate.trim() },
          ],
        }));
      },
      addStop: ({ day, leadId, locationId, workType, time }) => {
        let routeId = "";
        setData((d) => {
          const found = findOrCreateRouteId(d, day, leadId);
          routeId = found.routeId;
          const routes = found.created
            ? [...d.routes, { id: found.routeId, day, leadId }]
            : d.routes;
          const order =
            d.stops.filter((s) => s.routeId === found.routeId).length + 1;
          const stop: Stop = {
            id: uid("s"),
            routeId: found.routeId,
            order,
            locationId,
            workType,
            time,
          };
          return { ...d, routes, stops: [...d.stops, stop] };
        });
        return routeId || "R-???";
      },
      removeStop: (stopId) => {
        setData((d) => {
          const stop = d.stops.find((s) => s.id === stopId);
          if (!stop) return d;
          const stops = d.stops
            .filter((s) => s.id !== stopId)
            .map((s) =>
              s.routeId === stop.routeId && s.order > stop.order
                ? { ...s, order: s.order - 1 }
                : s,
            );
          const stillUsed = stops.some((s) => s.routeId === stop.routeId);
          const assigned = d.assignments.some((a) => a.routeId === stop.routeId);
          return {
            ...d,
            stops,
            routes:
              stillUsed || assigned
                ? d.routes
                : d.routes.filter((r) => r.id !== stop.routeId),
          };
        });
      },
      assign: (input) => {
        setData((d) => {
          if (
            d.assignments.some(
              (a) =>
                a.routeId === input.routeId &&
                a.technicianId === input.technicianId,
            )
          ) {
            return d;
          }
          return {
            ...d,
            assignments: [...d.assignments, { ...input, id: uid("a") }],
          };
        });
      },
      removeAssignment: (id) => {
        setData((d) => ({
          ...d,
          assignments: d.assignments.filter((a) => a.id !== id),
        }));
      },
    }),
    [data, ready],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore fuera de StoreProvider");
  return ctx;
}

export function nameOf(list: { id: string; name: string }[], id: string) {
  return list.find((x) => x.id === id)?.name ?? id;
}

export function payout(a: Assignment, leadId: string): number {
  if (a.technicianId !== leadId) return 0;
  return a.peopleOnRoute * a.perDiem;
}
