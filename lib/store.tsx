"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  isLocationPing,
  isStopAssignedTo,
  isStopDone,
  priorStop,
  progressOf,
  stampNow,
  tasksForWorkType,
} from "./hours";
import { dateOfWeekday, upcomingWeekday } from "./calendar";
import { withLocationCoords, type GeoFix } from "./geo";
import { hasSiteAddress, needsCompany } from "./install";
import { needsLodging } from "./lodging";
import { findOrCreateRouteId, nextTechnicianCode, uid } from "./ids";
import { nextWorkOrderId, syncWorkOrders } from "./orders";
import { applyPlaceToStop, migrateLocations } from "./regions";
import type { PlaceHit } from "./places";
import { isFreeForRoute } from "./availability";
import { hasAckedRoute, isRouteOpen } from "./record";
import { canRestOn, stopDate } from "./routeDays";
import { SEED } from "./seed";
import type {
  AppData,
  Assignment,
  Day,
  Location,
  LogEvent,
  Stop,
  StopProgress,
  Technician,
  VehicleKind,
  VehicleStatus,
  WorkOrder,
  WorkType,
} from "./types";
import { pickOperativeVehicleId } from "./vehicles";

const KEY = "despacho-inacap-v1";
const CHANNEL = "despacho-inacap-v1";

function withRev(data: AppData): AppData {
  return { ...data, updatedAt: Date.now() };
}

function withLeadOnRoute(
  data: AppData,
  routeId: string,
  leadId: string,
  vehicleId: string,
) {
  if (!leadId) {
    return {
      assignments: data.assignments,
      events: data.events ?? [],
    };
  }
  const van = pickOperativeVehicleId(data, vehicleId);
  if (!isFreeForRoute(data, leadId, routeId)) {
    return {
      assignments: data.assignments,
      events: data.events ?? [],
    };
  }
  if (
    data.assignments.some(
      (a) => a.routeId === routeId && a.technicianId === leadId,
    )
  ) {
    return {
      assignments: data.assignments.map((a) =>
        a.routeId === routeId ? { ...a, vehicleId: van || a.vehicleId } : a,
      ),
      events: data.events ?? [],
    };
  }
  return {
    assignments: [
      ...data.assignments,
      {
        id: uid("a"),
        routeId,
        technicianId: leadId,
        vehicleId: van,
        mode: "Individual" as const,
        peopleInVan: 1,
        peopleOnRoute: 1,
        perDiem: 10000,
      },
    ],
    events: logEvent(data.events ?? [], {
      technicianId: leadId,
      routeId,
      kind: "asignado",
      note: `Encargado de ${routeId}`,
    }),
  };
}

function dropVehicleFromOpenRoutes(data: AppData, vehicleId: string): AppData {
  const next = pickOperativeVehicleId(
    { ...data, vehicles: data.vehicles.filter((v) => v.id !== vehicleId) },
  );
  return {
    ...data,
    routes: data.routes.map((r) =>
      isRouteOpen(r) && r.vehicleId === vehicleId
        ? { ...r, vehicleId: next || undefined }
        : r,
    ),
    assignments: data.assignments.map((a) => {
      const route = data.routes.find((r) => r.id === a.routeId);
      if (route && isRouteOpen(route) && a.vehicleId === vehicleId) {
        return { ...a, vehicleId: next };
      }
      return a;
    }),
  };
}

function logEvent(
  events: LogEvent[],
  input: Omit<LogEvent, "id" | "at">,
): LogEvent[] {
  return [
    ...events,
    { ...input, id: uid("e"), at: Date.now() },
  ];
}

function normalize(data: AppData): AppData {
  data = migrateLocations(data);
  if (!data.progress) data.progress = [];
  if (!data.events) data.events = [];
  if (!data.workOrders) data.workOrders = [];
  data.locations = data.locations.map(withLocationCoords);
  data.vehicles = data.vehicles.map((v) => {
    const model = v.model || v.name;
    return {
      ...v,
      name: model,
      model,
      kind: v.kind ?? "Camioneta",
      plate: v.plate ?? "",
      status: v.status ?? "operativo",
    };
  });
  const closedIds = new Set(
    data.events
      .filter((e) => e.kind === "ruta_cerrada")
      .map((e) => e.routeId),
  );
  data.routes = data.routes.map((r) => {
    const closed =
      r.status === "finalizada" || Boolean(r.closedAt) || closedIds.has(r.id);
    return {
      ...r,
      status: closed ? ("finalizada" as const) : (r.status ?? "abierta"),
      closedAt: closed ? (r.closedAt ?? Date.now()) : undefined,
      date: r.date ?? upcomingWeekday(r.day),
      restDates: r.restDates ?? [],
      vehicleId:
        r.vehicleId ||
        data.assignments.find((a) => a.routeId === r.id)?.vehicleId ||
        undefined,
    };
  });
  data.stops = data.stops.map((s) => {
    const inherited = s.assigneeIds?.length
      ? s.assigneeIds
      : s.assigneeId
        ? [s.assigneeId]
        : [];
    if (inherited.length) return { ...s, assigneeIds: inherited, assigneeId: undefined };
    if (isLocationPing(s.workType)) return { ...s, assigneeIds: [], assigneeId: undefined };
    const route = data.routes.find((r) => r.id === s.routeId);
    return route?.leadId
      ? { ...s, assigneeIds: [route.leadId], assigneeId: undefined }
      : { ...s, assigneeIds: [], assigneeId: undefined };
  });
  if (data.events.length === 0 && data.assignments.length > 0) {
    data.events = data.assignments.map((a) => ({
      id: uid("e"),
      at: Date.now(),
      technicianId: a.technicianId,
      routeId: a.routeId,
      kind: "asignado" as const,
      note: "Asignación inicial",
    }));
  }
  data.workOrders = syncWorkOrders(data);
  return data;
}

function dropTravel(stop: Stop): Stop {
  return {
    ...stop,
    leaveAt: undefined,
    etaAt: undefined,
    travelMinutes: undefined,
    travelKm: undefined,
  };
}

function dropTravelFrom(stops: Stop[], routeId: string, fromOrder: number) {
  return stops.map((s) =>
    s.routeId === routeId && s.order >= fromOrder ? dropTravel(s) : s,
  );
}

function formatFixNote(fix?: GeoFix | null) {
  if (!fix) return "";
  const acc =
    fix.accuracyM != null && Number.isFinite(fix.accuracyM)
      ? ` ±${Math.round(fix.accuracyM)} m`
      : "";
  return ` · GPS ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}${acc}`;
}

type Store = {
  data: AppData;
  ready: boolean;
  reset: () => void;
  addTechnician: (name: string) => void;
  addLocation: (loc: Omit<Location, "id">) => void;
  addVehicle: (input: {
    model: string;
    kind: VehicleKind;
    plate: string;
  }) => void;
  removeTechnician: (id: string) => string | null;
  removeLocation: (id: string) => string | null;
  removeVehicle: (id: string) => void;
  updateTechnician: (id: string, name: string) => void;
  updateLocation: (id: string, name: string) => void;
  updateVehicle: (
    id: string,
    input: { model: string; kind: VehicleKind; plate: string },
  ) => void;
  setVehicleStatus: (id: string, status: VehicleStatus) => void;
  addWorkOrder: (input: {
    workType: WorkType;
    companyName: string;
    locationId: string;
    city?: string;
    address: string;
    installKind: string;
    destLat?: number;
    destLng?: number;
  }) => string;
  removeWorkOrder: (id: string) => void;
  addStop: (input: {
    day: Day;
    locationId: string;
    workType: WorkType;
    time: string;
    date?: string;
    routeId?: string;
    lodgingPlan?: string;
    installAddress?: string;
    installKind?: string;
    companyName?: string;
    workOrderId?: string;
    etaAt?: string;
    leaveAt?: string;
    travelMinutes?: number;
    travelKm?: number;
    destLat?: number;
    destLng?: number;
    city?: string;
    place?: PlaceHit;
  }) => string;
  addRestDay: (routeId: string, date: string) => void;
  removeRestDay: (routeId: string, date: string) => void;
  setStopLodgingPlan: (
    stopId: string,
    lodgingPlan: string,
    place?: PlaceHit,
  ) => void;
  confirmLodging: (stopId: string, technicianId: string) => void;
  changeLodging: (
    stopId: string,
    technicianId: string,
    place: string,
    hit?: PlaceHit,
  ) => void;
  setStopInstall: (
    stopId: string,
    input: { address?: string; kind?: string; company?: string; place?: PlaceHit },
  ) => void;
  confirmInstall: (stopId: string, technicianId: string) => void;
  changeInstall: (
    stopId: string,
    technicianId: string,
    address: string,
    hit?: PlaceHit,
  ) => void;
  setStopAssignees: (stopId: string, assigneeIds: string[]) => void;
  setStopTime: (stopId: string, time: string) => void;
  moveStop: (stopId: string, direction: -1 | 1) => void;
  setRouteLead: (routeId: string, leadId: string) => void;
  setRouteVehicle: (routeId: string, vehicleId: string) => void;
  removeStop: (stopId: string) => void;
  assign: (input: Omit<Assignment, "id">) => void;
  removeAssignment: (id: string) => void;
  acknowledgeRoute: (routeId: string, technicianId: string) => void;
  markArrival: (
    stopId: string,
    technicianId: string,
    fix?: GeoFix | null,
  ) => void;
  markDeparture: (
    stopId: string,
    technicianId: string,
    fix?: GeoFix | null,
    evidence?: { note: string; photo?: string },
  ) => void;
  toggleTask: (stopId: string, technicianId: string, taskId: string) => void;
  openChecklist: (stopId: string, technicianId: string) => void;
  replaceTechnician: (input: {
    routeId: string;
    fromId: string;
    toId: string;
    reason: string;
  }) => void;
  finishRoute: (routeId: string) => void;
};

const Ctx = createContext<Store | null>(null);

function ensureProgress(
  data: AppData,
  stopId: string,
  technicianId: string,
): StopProgress[] {
  const existing = data.progress.find(
    (p) => p.stopId === stopId && p.technicianId === technicianId,
  );
  if (existing) return data.progress;
  const stop = data.stops.find((s) => s.id === stopId);
  const created: StopProgress = {
    id: uid("p"),
    stopId,
    technicianId,
    arrivedAt: "",
    leftAt: "",
    tasks: tasksForWorkType(stop?.workType ?? "Traslado").map((label) => ({
      id: uid("tk"),
      label,
      done: false,
    })),
  };
  return [...data.progress, created];
}

function openStopRoute(data: AppData, stopId: string) {
  const stop = data.stops.find((s) => s.id === stopId);
  const route = data.routes.find((r) => r.id === stop?.routeId);
  if (!stop || !route || !isRouteOpen(route)) return null;
  return { stop, route };
}

function upsertProgress(
  data: AppData,
  stopId: string,
  technicianId: string,
  patch: Partial<
    Pick<
      StopProgress,
      | "arrivedAt"
      | "leftAt"
      | "arrivedAtMs"
      | "leftAtMs"
      | "arrivedLat"
      | "arrivedLng"
      | "arrivedAccuracyM"
      | "leftLat"
      | "leftLng"
      | "leftAccuracyM"
      | "closeNote"
      | "closePhoto"
    >
  >,
): StopProgress[] {
  const list = ensureProgress(data, stopId, technicianId);
  return list.map((p) =>
    p.stopId === stopId && p.technicianId === technicianId
      ? { ...p, ...patch }
      : p,
  );
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(SEED);
    return normalize(JSON.parse(raw) as AppData);
  } catch {
    return structuredClone(SEED);
  }
}

function writeStorage(next: AppData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => structuredClone(SEED));
  const [ready, setReady] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  function persist(next: AppData) {
    writeStorage(next);
    channelRef.current?.postMessage(next);
  }

  function applyIncoming(incoming: AppData) {
    const parsed = normalize(incoming);
    setData((prev) => {
      if ((parsed.updatedAt ?? 0) <= (prev.updatedAt ?? 0)) return prev;
      return parsed;
    });
  }

  useEffect(() => {
    setData(load());
    setReady(true);
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<AppData>) => {
      if (event.data) applyIncoming(event.data);
    };

    function onStorage(event: StorageEvent) {
      if (event.key !== KEY || !event.newValue) return;
      try {
        applyIncoming(JSON.parse(event.newValue) as AppData);
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("storage", onStorage);
    const id = window.setInterval(() => {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      try {
        applyIncoming(JSON.parse(raw) as AppData);
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  function bump(updater: (current: AppData) => AppData) {
    setData((current) => {
      const next = updater(current);
      if (next === current) return current;
      const rev = withRev(next);
      persist(rev);
      return rev;
    });
  }

  const api = useMemo<Store>(
    () => ({
      data,
      ready,
      reset: () => {
        const next = withRev(normalize(structuredClone(SEED)));
        persist(next);
        setData(next);
      },
      addTechnician: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        bump((d) => {
          const tech: Technician = {
            id: nextTechnicianCode(d),
            name: trimmed,
            active: true,
          };
          return { ...d, technicians: [...d.technicians, tech] };
        });
      },
      addLocation: (loc) => {
        bump((d) => ({
          ...d,
          locations: [...d.locations, { ...loc, id: uid("loc") }],
        }));
      },
      addVehicle: ({ model, kind, plate }) => {
        const trimmed = model.trim();
        if (!trimmed) return;
        bump((d) => ({
          ...d,
          vehicles: [
            ...d.vehicles,
            {
              id: uid("v"),
              name: trimmed,
              model: trimmed,
              kind,
              plate: plate.trim().toUpperCase(),
              status: "operativo",
            },
          ],
        }));
      },
      removeTechnician: (id) => {
        if (data.routes.some((r) => r.leadId === id && isRouteOpen(r))) {
          return "Es encargado de una ruta abierta. Reemplázalo o finaliza la ruta.";
        }
        bump((d) => {
          const openIds = new Set(
            d.routes.filter(isRouteOpen).map((r) => r.id),
          );
          return {
            ...d,
            technicians: d.technicians.filter((t) => t.id !== id),
            assignments: d.assignments.filter(
              (a) => a.technicianId !== id || !openIds.has(a.routeId),
            ),
            stops: d.stops.map((s) => {
              if (!openIds.has(s.routeId)) return s;
              const next = (s.assigneeIds ?? []).filter((x) => x !== id);
              if (next.length === (s.assigneeIds ?? []).length) return s;
              const route = d.routes.find((r) => r.id === s.routeId);
              return {
                ...s,
                assigneeIds:
                  next.length || !route || isLocationPing(s.workType)
                    ? next
                    : [route.leadId],
              };
            }),
          };
        });
        return null;
      },
      removeLocation: (id) => {
        const openIds = new Set(
          data.routes.filter(isRouteOpen).map((r) => r.id),
        );
        if (data.stops.some((s) => s.locationId === id && openIds.has(s.routeId))) {
          return "Esta locación está en una ruta abierta.";
        }
        bump((d) => ({
          ...d,
          locations: d.locations.filter((l) => l.id !== id),
        }));
        return null;
      },
      removeVehicle: (id) => {
        bump((d) => {
          const cleared = dropVehicleFromOpenRoutes(d, id);
          return {
            ...cleared,
            vehicles: cleared.vehicles.filter((v) => v.id !== id),
          };
        });
      },
      updateTechnician: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        bump((d) => ({
          ...d,
          technicians: d.technicians.map((t) =>
            t.id === id ? { ...t, name: trimmed } : t,
          ),
        }));
      },
      updateLocation: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        bump((d) => ({
          ...d,
          locations: d.locations.map((l) =>
            l.id === id ? { ...l, name: trimmed } : l,
          ),
        }));
      },
      updateVehicle: (id, { model, kind, plate }) => {
        const trimmed = model.trim();
        if (!trimmed) return;
        bump((d) => ({
          ...d,
          vehicles: d.vehicles.map((v) =>
            v.id === id
              ? {
                  ...v,
                  name: trimmed,
                  model: trimmed,
                  kind,
                  plate: plate.trim().toUpperCase(),
                }
              : v,
          ),
        }));
      },
      setVehicleStatus: (id, status) => {
        bump((d) => {
          const vehicles = d.vehicles.map((v) =>
            v.id === id ? { ...v, status } : v,
          );
          const next = { ...d, vehicles };
          return status === "fuera_de_servicio"
            ? dropVehicleFromOpenRoutes(next, id)
            : next;
        });
      },
      addWorkOrder: (input) => {
        const companyName = input.companyName.trim();
        const address = input.address.trim();
        const installKind = input.installKind.trim();
        let created = "";
        bump((d) => {
          const id = nextWorkOrderId(d);
          created = id;
          const createdOrder: WorkOrder = {
            id,
            workType: input.workType,
            companyName,
            locationId: input.locationId,
            city: input.city?.trim() || undefined,
            address,
            installKind,
            destLat: input.destLat,
            destLng: input.destLng,
            status: "pendiente",
            createdAt: Date.now(),
          };
          return { ...d, workOrders: [...(d.workOrders ?? []), createdOrder] };
        });
        return created;
      },
      removeWorkOrder: (id) => {
        bump((d) => {
          const existing = (d.workOrders ?? []).find((o) => o.id === id);
          if (!existing || existing.status !== "pendiente") return d;
          return {
            ...d,
            workOrders: d.workOrders.filter((o) => o.id !== id),
          };
        });
      },
      addStop: ({
        day,
        locationId,
        workType,
        time,
        date,
        routeId: existingId,
        lodgingPlan,
        installAddress,
        installKind,
        companyName,
        workOrderId,
        etaAt,
        leaveAt,
        travelMinutes,
        travelKm,
        destLat,
        destLng,
        city,
        place,
      }) => {
        let routeId = "";
        bump((d) => {
          const wo = workOrderId
            ? (d.workOrders ?? []).find(
                (o) => o.id === workOrderId && o.status === "pendiente",
              )
            : undefined;
          if (workOrderId && !wo) return d;
          const when = date ?? dateOfWeekday(day);
          const found = findOrCreateRouteId(d, day, when, existingId);
          routeId = found.routeId;
          const routes = found.created
            ? [
                ...d.routes,
                {
                  id: found.routeId,
                  day,
                  date: when,
                  leadId: "",
                  status: "abierta" as const,
                  restDates: [],
                },
              ]
            : d.routes.map((r) =>
                r.id === found.routeId
                  ? {
                      ...r,
                      restDates: (r.restDates ?? []).filter((x) => x !== when),
                    }
                  : r,
              );
          const nextOrder =
            d.stops.filter((s) => s.routeId === found.routeId).length + 1;
          const lodging = lodgingPlan?.trim() ?? "";
          const stopId = uid("s");
          const lat = destLat ?? wo?.destLat;
          const lng = destLng ?? wo?.destLng;
          let stop: Stop = {
            id: stopId,
            routeId: found.routeId,
            order: nextOrder,
            locationId,
            workType,
            time,
            date: when,
            assigneeIds: [],
            city: city?.trim() || wo?.city || undefined,
            workOrderId: wo?.id,
            ...(leaveAt || etaAt || lat != null
              ? {
                  leaveAt,
                  etaAt,
                  travelMinutes,
                  travelKm,
                  destLat: lat,
                  destLng: lng,
                }
              : {}),
            ...(needsLodging(workType)
              ? {
                  lodgingPlan: lodging,
                  lodgingStatus: "pendiente" as const,
                }
              : {}),
            ...(needsCompany(workType)
              ? { companyName: (companyName ?? wo?.companyName)?.trim() ?? "" }
              : {}),
            ...(hasSiteAddress(workType)
              ? {
                  installAddress:
                    (installAddress ?? wo?.address)?.trim() ?? "",
                  installKind:
                    (installKind ?? wo?.installKind)?.trim() ?? "",
                  installStatus: "pendiente" as const,
                }
              : wo?.address
                ? {
                    installAddress: wo.address,
                    installKind: wo.installKind || undefined,
                  }
                : {}),
          };
          if (place) stop = applyPlaceToStop(d, stop, place);
          return {
            ...d,
            routes,
            stops: [...d.stops, stop],
            workOrders: wo
              ? (d.workOrders ?? []).map((o) =>
                  o.id === wo.id
                    ? {
                        ...o,
                        status: "en_ruta" as const,
                        stopId,
                        routeId: found.routeId,
                      }
                    : o,
                )
              : d.workOrders,
          };
        });
        return routeId || "R-???";
      },
      addRestDay: (routeId, date) => {
        bump((d) => {
          const route = d.routes.find((r) => r.id === routeId);
          if (!route || !canRestOn(d, route, date)) return d;
          if ((route.restDates ?? []).includes(date)) return d;
          return {
            ...d,
            routes: d.routes.map((r) =>
              r.id === routeId
                ? {
                    ...r,
                    restDates: [...(r.restDates ?? []), date].sort(),
                  }
                : r,
            ),
          };
        });
      },
      removeRestDay: (routeId, date) => {
        bump((d) => {
          const route = d.routes.find((r) => r.id === routeId);
          if (!route || !isRouteOpen(route)) return d;
          if (!(route.restDates ?? []).includes(date)) return d;
          return {
            ...d,
            routes: d.routes.map((r) =>
              r.id === routeId
                ? {
                    ...r,
                    restDates: (r.restDates ?? []).filter((x) => x !== date),
                  }
                : r,
            ),
          };
        });
      },
      setStopLodgingPlan: (stopId, lodgingPlan, hit) => {
        const lodging = lodgingPlan.trim();
        bump((d) => ({
          ...d,
          stops: d.stops.map((s) => {
            if (s.id !== stopId || !needsLodging(s.workType)) return s;
            const next: Stop = {
              ...s,
              lodgingPlan: lodging,
              lodgingStay: undefined,
              lodgingStatus: "pendiente",
            };
            return hit ? applyPlaceToStop(d, next, hit) : next;
          }),
        }));
      },
      confirmLodging: (stopId, technicianId) => {
        bump((d) => {
          const stop = d.stops.find((s) => s.id === stopId);
          const route = d.routes.find((r) => r.id === stop?.routeId);
          if (
            !stop ||
            !needsLodging(stop.workType) ||
            !route?.leadId ||
            route.leadId !== technicianId ||
            !isRouteOpen(route)
          ) {
            return d;
          }
          const place = (stop.lodgingPlan || "").trim();
          if (!place) return d;
          return {
            ...d,
            stops: d.stops.map((s) =>
              s.id === stopId
                ? {
                    ...s,
                    lodgingStay: place,
                    lodgingStatus: "confirmado" as const,
                  }
                : s,
            ),
          };
        });
      },
      setStopInstall: (stopId, { address, kind, company, place: hit }) => {
        bump((d) => ({
          ...d,
          stops: d.stops.map((s) => {
            if (s.id !== stopId) return s;
            let next = s;
            if (company !== undefined && needsCompany(s.workType)) {
              next = { ...next, companyName: company.trim() };
            }
            if (!hasSiteAddress(s.workType) || (address === undefined && kind === undefined && !hit)) {
              return next;
            }
            const nextAddress =
              address !== undefined ? address.trim() : (next.installAddress ?? "");
            const addressChanged =
              address !== undefined && nextAddress !== (next.installAddress ?? "");
            next = {
              ...next,
              installAddress: nextAddress,
              installKind:
                kind !== undefined ? kind.trim() : (next.installKind ?? ""),
              ...(addressChanged
                ? {
                    installAddressStay: undefined,
                    installStatus: "pendiente" as const,
                  }
                : {}),
            };
            return hit ? applyPlaceToStop(d, next, hit) : next;
          }),
        }));
      },
      confirmInstall: (stopId, technicianId) => {
        bump((d) => {
          const stop = d.stops.find((s) => s.id === stopId);
          const route = d.routes.find((r) => r.id === stop?.routeId);
          if (
            !stop ||
            !hasSiteAddress(stop.workType) ||
            !route?.leadId ||
            route.leadId !== technicianId ||
            !isRouteOpen(route)
          ) {
            return d;
          }
          const place = (stop.installAddress || "").trim();
          if (!place) return d;
          return {
            ...d,
            stops: d.stops.map((s) =>
              s.id === stopId
                ? {
                    ...s,
                    installAddressStay: place,
                    installStatus: "confirmado" as const,
                  }
                : s,
            ),
          };
        });
      },
      changeInstall: (stopId, technicianId, address, hit) => {
        const stay = address.trim();
        if (!stay) return;
        bump((d) => {
          const stop = d.stops.find((s) => s.id === stopId);
          const route = d.routes.find((r) => r.id === stop?.routeId);
          if (
            !stop ||
            !hasSiteAddress(stop.workType) ||
            !route?.leadId ||
            route.leadId !== technicianId ||
            !isRouteOpen(route)
          ) {
            return d;
          }
          return {
            ...d,
            stops: d.stops.map((s) => {
              if (s.id !== stopId) return s;
              const updated: Stop = {
                ...s,
                installAddressStay: stay,
                installStatus: "cambiado" as const,
              };
              return hit ? applyPlaceToStop(d, updated, hit) : updated;
            }),
          };
        });
      },
      changeLodging: (stopId, technicianId, place, hit) => {
        const stay = place.trim();
        if (!stay) return;
        bump((d) => {
          const stop = d.stops.find((s) => s.id === stopId);
          const route = d.routes.find((r) => r.id === stop?.routeId);
          if (
            !stop ||
            !needsLodging(stop.workType) ||
            !route?.leadId ||
            route.leadId !== technicianId ||
            !isRouteOpen(route)
          ) {
            return d;
          }
          return {
            ...d,
            stops: d.stops.map((s) => {
              if (s.id !== stopId) return s;
              const updated: Stop = {
                ...s,
                lodgingStay: stay,
                lodgingStatus: "cambiado" as const,
              };
              return hit ? applyPlaceToStop(d, updated, hit) : updated;
            }),
          };
        });
      },
      setRouteLead: (routeId, leadId) => {
        bump((d) => {
          const route = d.routes.find((r) => r.id === routeId);
          if (!route) return d;
          if (leadId && !isFreeForRoute(d, leadId, routeId)) return d;
          const routes = d.routes.map((r) =>
            r.id === routeId ? { ...r, leadId } : r,
          );
          if (!leadId) return { ...d, routes };
          const withRoute = { ...d, routes };
          const van = pickOperativeVehicleId(withRoute, route.vehicleId);
          const crew = withLeadOnRoute(withRoute, routeId, leadId, van);
          return {
            ...d,
            routes,
            assignments: crew.assignments,
            events: crew.events,
          };
        });
      },
      setStopAssignees: (stopId, assigneeIds) => {
        bump((d) => {
          const stop = d.stops.find((s) => s.id === stopId);
          if (!stop || isLocationPing(stop.workType)) return d;
          const route = d.routes.find((r) => r.id === stop.routeId);
          const allowed = assigneeIds.filter(
            (id) =>
              id === route?.leadId ||
              d.assignments.some(
                (a) => a.routeId === stop.routeId && a.technicianId === id,
              ),
          );
          if (allowed.length === 0) return d;
          return {
            ...d,
            stops: d.stops.map((s) =>
              s.id === stopId ? { ...s, assigneeIds: allowed, assigneeId: undefined } : s,
            ),
          };
        });
      },
      setRouteVehicle: (routeId, vehicleId) => {
        bump((d) => {
          const van = pickOperativeVehicleId(d, vehicleId);
          if (!van) return d;
          return {
            ...d,
            routes: d.routes.map((r) =>
              r.id === routeId ? { ...r, vehicleId: van } : r,
            ),
            assignments: d.assignments.map((a) =>
              a.routeId === routeId ? { ...a, vehicleId: van } : a,
            ),
          };
        });
      },
      setStopTime: (stopId, time) => {
        bump((d) => ({
          ...d,
          stops: d.stops.map((s) =>
            s.id === stopId ? dropTravel({ ...s, time }) : s,
          ),
        }));
      },
      moveStop: (stopId, direction) => {
        bump((d) => {
          const stop = d.stops.find((s) => s.id === stopId);
          if (!stop) return d;
          const route = d.routes.find((r) => r.id === stop.routeId);
          if (!route || !isRouteOpen(route)) return d;
          const day = stopDate(stop, route);
          const peers = d.stops
            .filter(
              (s) => s.routeId === stop.routeId && stopDate(s, route) === day,
            )
            .sort((a, b) => a.order - b.order);
          const index = peers.findIndex((s) => s.id === stopId);
          const other = peers[index + direction];
          if (!other) return d;
          const from = Math.min(stop.order, other.order);
          const swapped = d.stops.map((s) => {
            if (s.id === stop.id) return { ...s, order: other.order };
            if (s.id === other.id) return { ...s, order: stop.order };
            return s;
          });
          return {
            ...d,
            stops: dropTravelFrom(swapped, stop.routeId, from),
          };
        });
      },
      removeStop: (stopId) => {
        bump((d) => {
          const stop = d.stops.find((s) => s.id === stopId);
          if (!stop) return d;
          const stops = dropTravelFrom(
            d.stops
              .filter((s) => s.id !== stopId)
              .map((s) =>
                s.routeId === stop.routeId && s.order > stop.order
                  ? { ...s, order: s.order - 1 }
                  : s,
              ),
            stop.routeId,
            stop.order,
          );
          const stillUsed = stops.some((s) => s.routeId === stop.routeId);
          const assigned = d.assignments.some((a) => a.routeId === stop.routeId);
          return {
            ...d,
            stops,
            progress: d.progress.filter((p) => p.stopId !== stopId),
            workOrders: stop.workOrderId
              ? (d.workOrders ?? []).map((o) =>
                  o.id === stop.workOrderId && o.status !== "cerrada"
                    ? {
                        ...o,
                        status: "pendiente" as const,
                        stopId: undefined,
                        routeId: undefined,
                      }
                    : o,
                )
              : d.workOrders,
            routes:
              stillUsed || assigned
                ? d.routes
                : d.routes.filter((r) => r.id !== stop.routeId),
          };
        });
      },
      assign: (input) => {
        bump((d) => {
          if (
            d.assignments.some(
              (a) =>
                a.routeId === input.routeId &&
                a.technicianId === input.technicianId,
            )
          ) {
            return d;
          }
          if (!isFreeForRoute(d, input.technicianId, input.routeId)) return d;
          const route = d.routes.find((r) => r.id === input.routeId);
          const van = pickOperativeVehicleId(
            d,
            route?.vehicleId ||
              d.assignments.find((a) => a.routeId === input.routeId)?.vehicleId,
          );
          const together = d.assignments.some((a) => a.routeId === input.routeId);
          return {
            ...d,
            assignments: [
              ...d.assignments.map((a) =>
                a.routeId === input.routeId
                  ? { ...a, vehicleId: van, mode: "Grupal" as const }
                  : a,
              ),
              {
                ...input,
                id: uid("a"),
                vehicleId: van,
                mode: together ? ("Grupal" as const) : input.mode,
                peopleInVan: 0,
                peopleOnRoute: 0,
              },
            ],
            events: logEvent(d.events ?? [], {
              technicianId: input.technicianId,
              routeId: input.routeId,
              kind: "asignado",
              note: `Asignado a ${input.routeId}`,
            }),
          };
        });
      },
      removeAssignment: (id) => {
        bump((d) => {
          const row = d.assignments.find((a) => a.id === id);
          const route = row
            ? d.routes.find((r) => r.id === row.routeId)
            : undefined;
          if (row && route && row.technicianId === route.leadId) return d;
          return {
            ...d,
            assignments: d.assignments.filter((a) => a.id !== id),
            stops: row
              ? d.stops.map((s) => {
                  if (s.routeId !== row.routeId) return s;
                  const ids = (s.assigneeIds?.length
                    ? s.assigneeIds
                    : s.assigneeId
                      ? [s.assigneeId]
                      : []
                  ).filter((id) => id !== row.technicianId);
                  if (ids.length === (s.assigneeIds?.length ?? (s.assigneeId ? 1 : 0))) {
                    return s;
                  }
                  return {
                    ...s,
                    assigneeIds: ids.length ? ids : route?.leadId ? [route.leadId] : [],
                    assigneeId: undefined,
                  };
                })
              : d.stops,
            events: row
              ? logEvent(d.events ?? [], {
                  technicianId: row.technicianId,
                  routeId: row.routeId,
                  kind: "baja",
                  note: "Quitado de la ruta",
                })
              : d.events,
          };
        });
      },
      acknowledgeRoute: (routeId, technicianId) => {
        bump((d) => {
          const route = d.routes.find((r) => r.id === routeId);
          if (!route || !isRouteOpen(route)) return d;
          const row = d.assignments.find(
            (a) => a.routeId === routeId && a.technicianId === technicianId,
          );
          if (!row || row.seenAt) return d;
          const who = d.technicians.find((t) => t.id === technicianId)?.name;
          return {
            ...d,
            assignments: d.assignments.map((a) =>
              a.id === row.id ? { ...a, seenAt: Date.now() } : a,
            ),
            events: logEvent(d.events ?? [], {
              technicianId,
              routeId,
              kind: "visto",
              note: `${who ?? technicianId} vio el itinerario de ${routeId}`,
            }),
          };
        });
      },
      markArrival: (stopId, technicianId, fix) => {
        bump((d) => {
          const opened = openStopRoute(d, stopId);
          if (!opened) return d;
          const { stop } = opened;
          const current = progressOf(d.progress, stopId, technicianId);
          if (current?.arrivedAt) return d;
          if (!isStopAssignedTo(stop, technicianId)) return d;
          if (!hasAckedRoute(d, stop.routeId, technicianId)) return d;
          const previous = priorStop(d.stops, stop, technicianId);
          if (previous) {
            const prev = progressOf(d.progress, previous.id, technicianId);
            if (!isStopDone(previous, prev)) return d;
          }
          const stamp = stampNow();
          const gps = formatFixNote(fix);
          return {
            ...d,
            progress: upsertProgress(d, stopId, technicianId, {
              arrivedAt: stamp.time,
              arrivedAtMs: stamp.ms,
              ...(fix
                ? {
                    arrivedLat: fix.lat,
                    arrivedLng: fix.lng,
                    arrivedAccuracyM: fix.accuracyM,
                  }
                : {}),
            }),
            events: logEvent(d.events ?? [], {
              technicianId,
              routeId: stop.routeId,
              stopId,
              kind: "llegada",
              note: `${stop.workType} · llegó ${stamp.time}${gps}`,
            }),
          };
        });
      },
      markDeparture: (stopId, technicianId, fix, evidence) => {
        bump((d) => {
          const opened = openStopRoute(d, stopId);
          if (!opened) return d;
          const { stop } = opened;
          if (isLocationPing(stop.workType)) return d;
          const current = progressOf(d.progress, stopId, technicianId);
          if (!current?.arrivedAt || current.leftAt) return d;
          if (current.arrivedAtMs && Date.now() < current.arrivedAtMs) return d;
          const note = evidence?.note.trim() ?? "";
          if (!note) return d;
          const stamp = stampNow();
          const gps = formatFixNote(fix);
          const photo = evidence?.photo?.trim();
          return {
            ...d,
            progress: upsertProgress(d, stopId, technicianId, {
              leftAt: stamp.time,
              leftAtMs: stamp.ms,
              closeNote: note,
              ...(photo ? { closePhoto: photo } : {}),
              ...(fix
                ? {
                    leftLat: fix.lat,
                    leftLng: fix.lng,
                    leftAccuracyM: fix.accuracyM,
                  }
                : {}),
            }),
            events: logEvent(d.events ?? [], {
              technicianId,
              routeId: stop.routeId,
              stopId,
              kind: "salida",
              note: `Cerró trabajo ${stamp.time}${gps} · ${note.slice(0, 180)}`,
            }),
          };
        });
      },
      toggleTask: (stopId, technicianId, taskId) => {
        bump((d) => {
          if (!openStopRoute(d, stopId)) return d;
          const list = ensureProgress(d, stopId, technicianId);
          return {
            ...d,
            progress: list.map((p) =>
              p.stopId === stopId && p.technicianId === technicianId
                ? {
                    ...p,
                    tasks: p.tasks.map((t) =>
                      t.id === taskId ? { ...t, done: !t.done } : t,
                    ),
                  }
                : p,
            ),
          };
        });
      },
      openChecklist: (stopId, technicianId) => {
        bump((d) => {
          if (!openStopRoute(d, stopId)) return d;
          const next = ensureProgress(d, stopId, technicianId);
          if (next === d.progress) return d;
          return { ...d, progress: next };
        });
      },
      replaceTechnician: ({ routeId, fromId, toId, reason }) => {
        bump((d) => {
          if (!fromId || !toId || fromId === toId) return d;
          const route = d.routes.find((r) => r.id === routeId);
          if (!route || !isRouteOpen(route)) return d;
          const current = d.assignments.find(
            (a) => a.routeId === routeId && a.technicianId === fromId,
          );
          if (!current) return d;
          if (
            d.assignments.some(
              (a) => a.routeId === routeId && a.technicianId === toId,
            )
          ) {
            return d;
          }
          if (!isFreeForRoute(d, toId, routeId)) return d;
          const note = reason.trim() || "Sin motivo";
          let events = logEvent(d.events ?? [], {
            technicianId: fromId,
            routeId,
            kind: "baja",
            note,
            relatedTechnicianId: toId,
          });
          events = logEvent(events, {
            technicianId: toId,
            routeId,
            kind: "entra",
            note: `Cubre a compañero · ${note}`,
            relatedTechnicianId: fromId,
          });
          return {
            ...d,
            routes:
              route.leadId === fromId
                ? d.routes.map((r) =>
                    r.id === routeId ? { ...r, leadId: toId } : r,
                  )
                : d.routes,
            assignments: d.assignments.map((a) =>
              a.id === current.id
                ? { ...a, technicianId: toId, seenAt: undefined }
                : a,
            ),
            stops: d.stops.map((s) => {
              if (s.routeId !== routeId) return s;
              const ids = s.assigneeIds?.length
                ? s.assigneeIds
                : s.assigneeId
                  ? [s.assigneeId]
                  : [];
              if (!ids.includes(fromId)) return s;
              return {
                ...s,
                assigneeIds: [...new Set(ids.map((id) => (id === fromId ? toId : id)))],
                assigneeId: undefined,
              };
            }),
            events,
          };
        });
      },
      finishRoute: (routeId) => {
        bump((d) => {
          const route = d.routes.find((r) => r.id === routeId);
          if (!route || !isRouteOpen(route)) return d;
          const crew = d.assignments.filter((a) => a.routeId === routeId);
          let events = d.events ?? [];
          for (const a of crew) {
            events = logEvent(events, {
              technicianId: a.technicianId,
              routeId,
              kind: "ruta_cerrada",
              note: `Jefatura finalizó ${routeId}`,
            });
          }
          return {
            ...d,
            routes: d.routes.map((r) =>
              r.id === routeId
                ? { ...r, status: "finalizada", closedAt: Date.now() }
                : r,
            ),
            workOrders: (d.workOrders ?? []).map((o) =>
              o.routeId === routeId
                ? { ...o, status: "cerrada" as const }
                : o,
            ),
            events,
          };
        });
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

export function payout(a: Assignment, leadId: string, crewSize = 1): number {
  if (a.technicianId !== leadId) return 0;
  return crewSize * a.perDiem;
}
