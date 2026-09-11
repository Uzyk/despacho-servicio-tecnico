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
import { cleanMaterials, kitComplete, materialsForStop, mergeLeadKit } from "./kit";
import { nextWorkOrderId, syncWorkOrders } from "./orders";
import { applyPlaceToStop, migrateLocations } from "./regions";
import type { PlaceHit } from "./places";
import { isFreeForRoute, isVehicleFreeForRoute, pickFreeVehicleId } from "./availability";
import { hasAckedRoute, isRouteOpen } from "./record";
import { canRestOn, stopDate } from "./routeDays";
import { pullRemote, pushRemote } from "./remote";
import { SEED, SEED_TECHNICIANS } from "./seed";
import { hashPassword, normalizeEmail, SESSION_KEY, avatarDataUrl } from "./auth";
import type {
  Account,
  AccountRole,
  AppData,
  Assignment,
  Day,
  Invite,
  Location,
  LogEvent,
  RouteAllowances,
  Stop,
  StopProgress,
  Technician,
  VehicleKind,
  VehicleStatus,
  WorkOrder,
  WorkType,
  KitItem,
} from "./types";
import {
  cleanAllowances,
  DEFAULT_LUNCH,
  withOvernightDefaults,
} from "./allowances";

const KEY = "despacho-inacap-v2";
const CHANNEL = "despacho-inacap-v2";

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
  const van = pickFreeVehicleId(data, routeId, vehicleId);
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
        perDiem: DEFAULT_LUNCH,
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

function withFreeRouteVehicle(data: AppData, routeId: string): AppData {
  const preferred = data.routes.find((r) => r.id === routeId)?.vehicleId;
  const van = pickFreeVehicleId(data, routeId, preferred);
  if ((preferred || "") === van) return data;
  return {
    ...data,
    routes: data.routes.map((r) =>
      r.id === routeId ? { ...r, vehicleId: van || undefined } : r,
    ),
    assignments: data.assignments.map((a) =>
      a.routeId === routeId ? { ...a, vehicleId: van } : a,
    ),
  };
}

function dropVehicleFromOpenRoutes(data: AppData, vehicleId: string): AppData {
  let next = data;
  const hit = next.routes.filter(
    (r) => isRouteOpen(r) && r.vehicleId === vehicleId,
  );
  for (const route of hit) {
    const van = pickFreeVehicleId(next, route.id);
    next = {
      ...next,
      routes: next.routes.map((r) =>
        r.id === route.id ? { ...r, vehicleId: van || undefined } : r,
      ),
      assignments: next.assignments.map((a) =>
        a.routeId === route.id && a.vehicleId === vehicleId
          ? { ...a, vehicleId: van }
          : a,
      ),
    };
  }
  return next;
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
  data.technicians = data.technicians.map((t) => {
    const match = t.id.match(/^T(\d+)$/);
    const seedName = match
      ? SEED_TECHNICIANS[Number(match[1]) - 1]
      : undefined;
    if (!seedName) return t;
    if (!t.name || /^Técnico\s+\d+$/i.test(t.name)) {
      return { ...t, name: seedName };
    }
    return t;
  });
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
      allowances: cleanAllowances(
        r.allowances ?? {
          lunch:
            data.assignments.find(
              (a) => a.routeId === r.id && a.technicianId === r.leadId,
            )?.perDiem ?? DEFAULT_LUNCH,
        },
      ),
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
  data.workOrders = (data.workOrders ?? []).map((order) => {
    const seed = SEED.workOrders.find((item) => item.id === order.id);
    return {
      ...order,
      materials: cleanMaterials(order.materials),
      contactName: order.contactName?.trim() || seed?.contactName,
      contactPhone: order.contactPhone?.trim() || seed?.contactPhone,
    };
  });
  data.assignments = data.assignments.map((a) => {
    const van = data.routes.find((r) => r.id === a.routeId)?.vehicleId;
    return van && a.vehicleId !== van ? { ...a, vehicleId: van } : a;
  });
  data.progress = (data.progress ?? []).map((p) => ({
    ...p,
    kit: Array.isArray(p.kit) ? p.kit : undefined,
  }));
  data.workOrders = syncWorkOrders(data);
  if (!data.accounts) data.accounts = [];
  if (!data.invites) data.invites = [];
  for (const acc of SEED.accounts) {
    if (!data.accounts.some((a) => a.email === acc.email)) {
      data.accounts.push(acc);
    }
  }
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
  account: Account | null;
  reset: () => void;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
  createInvite: (input: {
    email: string;
    name: string;
    role: Exclude<AccountRole, "admin">;
  }) => { error?: string; invite?: Invite };
  acceptInvite: (input: {
    token: string;
    password: string;
    phone: string;
    photo?: string;
    name?: string;
    city?: string;
  }) => Promise<{ error?: string; account?: Account }>;
  updateProfile: (input: {
    name?: string;
    phone?: string;
    title?: string;
    city?: string;
    photo?: string;
    password?: string;
  }) => Promise<string | null>;
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
    contactName: string;
    contactPhone: string;
    locationId: string;
    city?: string;
    address: string;
    installKind: string;
    materials: KitItem[];
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
  setRouteAllowances: (routeId: string, allowances: RouteAllowances) => void;
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
    evidence?: {
      note: string;
      photo?: string;
      outcome?: "realizado" | "no_realizado";
      failReason?: string;
    },
  ) => void;
  toggleTask: (stopId: string, technicianId: string, taskId: string) => void;
  toggleKit: (stopId: string, technicianId: string, itemId: string) => void;
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

function withLeadKit(
  data: AppData,
  stopId: string,
  technicianId: string,
): StopProgress[] {
  const list = ensureProgress(data, stopId, technicianId);
  const opened = openStopRoute(data, stopId);
  if (!opened || opened.route.leadId !== technicianId) return list;
  const materials = materialsForStop(data, opened.stop);
  if (!materials.length) return list;
  let changed = false;
  const next = list.map((p) => {
    if (p.stopId !== stopId || p.technicianId !== technicianId) return p;
    const merged = mergeLeadKit(p, materials);
    if (merged !== p) changed = true;
    return merged;
  });
  return changed || list !== data.progress ? next : data.progress;
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
      | "outcome"
      | "failReason"
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
    const parsed = normalize(JSON.parse(raw) as AppData);
    writeStorage(parsed);
    return parsed;
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

function readSessionId() {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(SESSION_KEY, id);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => structuredClone(SEED));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  function persist(next: AppData) {
    writeStorage(next);
    channelRef.current?.postMessage(next);
    pushRemote(next);
  }

  function applyIncoming(incoming: AppData) {
    const parsed = normalize(incoming);
    setData((prev) => {
      if ((parsed.updatedAt ?? 0) <= (prev.updatedAt ?? 0)) return prev;
      writeStorage(parsed);
      return parsed;
    });
  }

  function adoptSession(next: AppData) {
    const saved = readSessionId();
    if (saved && next.accounts.some((a) => a.id === saved)) {
      setSessionId(saved);
    } else {
      writeSessionId(null);
      setSessionId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const local = load();
      if (cancelled) return;
      setData(local);
      adoptSession(local);
      const remote = await pullRemote();
      if (cancelled) return;
      if (remote && (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
        const parsed = normalize(remote);
        writeStorage(parsed);
        setData(parsed);
        adoptSession(parsed);
      } else {
        pushRemote(local);
      }
      setReady(true);
    }
    void boot();
    return () => {
      cancelled = true;
    };
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
    const remoteId = window.setInterval(() => {
      void pullRemote().then((remote) => {
        if (remote) applyIncoming(remote);
      });
    }, 2000);
    function flushWhenOnline() {
      if (!navigator.onLine) return;
      void pullRemote().then((remote) => {
        setData((current) => {
          if (remote && (remote.updatedAt ?? 0) > (current.updatedAt ?? 0)) {
            const parsed = normalize(remote);
            writeStorage(parsed);
            return parsed;
          }
          pushRemote(current);
          return current;
        });
      });
    }
    window.addEventListener("online", flushWhenOnline);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("online", flushWhenOnline);
      window.clearInterval(id);
      window.clearInterval(remoteId);
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

  const account =
    (data.accounts ?? []).find((a) => a.id === sessionId) ?? null;

  const api = useMemo<Store>(
    () => ({
      data,
      ready,
      account,
      reset: () => {
        const next = withRev(normalize(structuredClone(SEED)));
        persist(next);
        setData(next);
        if (sessionId && !next.accounts.some((a) => a.id === sessionId)) {
          writeSessionId(null);
          setSessionId(null);
        }
      },
      login: async (email, password) => {
        const hash = await hashPassword(password);
        const found = data.accounts.find(
          (a) => a.email === normalizeEmail(email) && a.passwordHash === hash,
        );
        if (!found) return "Correo o clave incorrectos.";
        writeSessionId(found.id);
        setSessionId(found.id);
        return null;
      },
      logout: () => {
        writeSessionId(null);
        setSessionId(null);
      },
      createInvite: ({ email, name, role }) => {
        const cleanEmail = normalizeEmail(email);
        const cleanName = name.trim();
        if (!cleanEmail || !cleanEmail.includes("@")) {
          return { error: "Ingresa un correo válido." };
        }
        if (!cleanName) return { error: "Ingresa el nombre de la persona." };
        if (data.accounts.some((a) => a.email === cleanEmail)) {
          return { error: "Ese correo ya tiene cuenta." };
        }
        if (
          data.invites.some(
            (i) => i.email === cleanEmail && !i.usedAt && i.expiresAt > Date.now(),
          )
        ) {
          return { error: "Ya hay una invitación vigente para ese correo." };
        }
        const invite: Invite = {
          id: uid("inv"),
          token: crypto.randomUUID(),
          email: cleanEmail,
          role,
          name: cleanName,
          createdAt: Date.now(),
          expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
        };
        bump((d) => ({ ...d, invites: [...d.invites, invite] }));
        return { invite };
      },
      acceptInvite: async ({ token, password, phone, photo, name, city }) => {
        const invite = data.invites.find((i) => i.token === token);
        if (!invite || invite.usedAt || invite.expiresAt <= Date.now()) {
          return { error: "Esta invitación no es válida o ya venció." };
        }
        if (password.trim().length < 6) {
          return { error: "La clave debe tener al menos 6 caracteres." };
        }
        if (data.accounts.some((a) => a.email === invite.email)) {
          return { error: "Ese correo ya tiene cuenta." };
        }
        const passwordHash = await hashPassword(password);
        const displayName = (name || invite.name).trim();
        const accountId = uid("u");
        bump((d) => {
          let technicians = d.technicians;
          let technicianId: string | undefined;
          if (invite.role === "tecnico") {
            technicianId = nextTechnicianCode(d);
            technicians = [
              ...d.technicians,
              { id: technicianId, name: displayName, active: true },
            ];
          }
          const account: Account = {
            id: accountId,
            email: invite.email,
            passwordHash,
            role: invite.role,
            name: displayName,
            phone: phone.trim(),
            title: invite.role === "tecnico" ? "Técnico de terreno" : "Jefatura",
            city: (city || "Santiago").trim(),
            photo: photo || avatarDataUrl(displayName),
            technicianId,
            createdAt: Date.now(),
          };
          writeSessionId(account.id);
          setSessionId(account.id);
          return {
            ...d,
            technicians,
            accounts: [...d.accounts, account],
            invites: d.invites.map((i) =>
              i.token === token ? { ...i, usedAt: Date.now() } : i,
            ),
          };
        });
        return { account: { id: accountId } as Account };
      },
      updateProfile: async (input) => {
        if (!account) return "Debes iniciar sesión.";
        let passwordHash = account.passwordHash;
        if (input.password) {
          if (input.password.trim().length < 6) {
            return "La clave debe tener al menos 6 caracteres.";
          }
          passwordHash = await hashPassword(input.password);
        }
        bump((d) => ({
          ...d,
          accounts: d.accounts.map((a) =>
            a.id === account.id
              ? {
                  ...a,
                  name: input.name?.trim() || a.name,
                  phone: input.phone?.trim() || a.phone,
                  title: input.title?.trim() || a.title,
                  city: input.city?.trim() || a.city,
                  photo: input.photo || a.photo,
                  passwordHash,
                }
              : a,
          ),
          technicians:
            account.technicianId && input.name?.trim()
              ? d.technicians.map((t) =>
                  t.id === account.technicianId
                    ? { ...t, name: input.name!.trim() }
                    : t,
                )
              : d.technicians,
        }));
        return null;
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
        const contactName = input.contactName.trim();
        const contactPhone = input.contactPhone.trim();
        const address = input.address.trim();
        const installKind = input.installKind.trim();
        const materials = cleanMaterials(input.materials);
        let created = "";
        bump((d) => {
          const id = nextWorkOrderId(d);
          created = id;
          const createdOrder: WorkOrder = {
            id,
            workType: input.workType,
            companyName,
            contactName: contactName || undefined,
            contactPhone: contactPhone || undefined,
            locationId: input.locationId,
            city: input.city?.trim() || undefined,
            address,
            installKind,
            materials,
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
          const overnight = needsLodging(workType);
          const staged = withFreeRouteVehicle(
            {
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
            },
            found.routeId,
          );
          return {
            ...staged,
            routes: staged.routes.map((r) => {
              if (r.id !== found.routeId) return r;
              return {
                ...r,
                allowances: overnight
                  ? withOvernightDefaults(r.allowances)
                  : cleanAllowances(r.allowances),
              };
            }),
          };
        });
        return routeId || "R-???";
      },
      addRestDay: (routeId, date) => {
        bump((d) => {
          const route = d.routes.find((r) => r.id === routeId);
          if (!route || !canRestOn(d, route, date)) return d;
          if ((route.restDates ?? []).includes(date)) return d;
          return withFreeRouteVehicle(
            {
              ...d,
              routes: d.routes.map((r) =>
                r.id === routeId
                  ? {
                      ...r,
                      restDates: [...(r.restDates ?? []), date].sort(),
                    }
                  : r,
              ),
            },
            routeId,
          );
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
          const van = pickFreeVehicleId(withRoute, routeId, route.vehicleId);
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
          if (!vehicleId || !isVehicleFreeForRoute(d, vehicleId, routeId)) {
            return d;
          }
          const van = vehicleId;
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
      setRouteAllowances: (routeId, allowances) => {
        bump((d) => {
          const route = d.routes.find((r) => r.id === routeId);
          if (!route || !isRouteOpen(route)) return d;
          const next = cleanAllowances(allowances);
          return {
            ...d,
            routes: d.routes.map((r) =>
              r.id === routeId ? { ...r, allowances: next } : r,
            ),
            assignments: d.assignments.map((a) =>
              a.routeId === routeId ? { ...a, perDiem: next.lunch } : a,
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
          const route = d.routes.find((r) => r.id === stop.routeId);
          if (route && !isRouteOpen(route)) return d;
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
          const van = pickFreeVehicleId(
            d,
            input.routeId,
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
          const missed = evidence?.outcome === "no_realizado";
          const reason = evidence?.failReason?.trim() ?? "";
          const note = evidence?.note.trim() ?? "";
          if (missed) {
            if (!reason) return d;
            if (reason === "Otro" && !note) return d;
            if (opened.route.leadId !== technicianId) return d;
          } else if (!note) {
            return d;
          }
          if (
            !missed &&
            opened.route.leadId === technicianId &&
            materialsForStop(d, stop).length > 0 &&
            (!current.kit?.length || !kitComplete(current.kit))
          ) {
            return d;
          }
          const stamp = stampNow();
          const gps = formatFixNote(fix);
          const photo = evidence?.photo?.trim();
          const closeNote = missed
            ? note
              ? `No se realizó · ${reason}. ${note}`
              : `No se realizó · ${reason}`
            : note;
          return {
            ...d,
            progress: upsertProgress(d, stopId, technicianId, {
              leftAt: stamp.time,
              leftAtMs: stamp.ms,
              closeNote,
              outcome: missed ? "no_realizado" : "realizado",
              failReason: missed ? reason : undefined,
              ...(photo ? { closePhoto: photo } : {}),
              ...(fix
                ? {
                    leftLat: fix.lat,
                    leftLng: fix.lng,
                    leftAccuracyM: fix.accuracyM,
                  }
                : {}),
            }),
            workOrders: stop.workOrderId
              ? (d.workOrders ?? []).map((o) =>
                  o.id === stop.workOrderId
                    ? {
                        ...o,
                        status: missed
                          ? ("no_realizada" as const)
                          : o.status,
                      }
                    : o,
                )
              : d.workOrders,
            events: logEvent(d.events ?? [], {
              technicianId,
              routeId: stop.routeId,
              stopId,
              kind: "salida",
              note: missed
                ? `No se realizó ${stamp.time}${gps} · ${reason}`
                : `Cerró trabajo ${stamp.time}${gps} · ${note.slice(0, 180)}`,
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
      toggleKit: (stopId, technicianId, itemId) => {
        bump((d) => {
          const opened = openStopRoute(d, stopId);
          if (!opened || opened.route.leadId !== technicianId) return d;
          const list = withLeadKit(d, stopId, technicianId);
          return {
            ...d,
            progress: list.map((p) =>
              p.stopId === stopId && p.technicianId === technicianId
                ? {
                    ...p,
                    kit: (p.kit ?? []).map((item) =>
                      item.id === itemId ? { ...item, done: !item.done } : item,
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
          const next = withLeadKit(d, stopId, technicianId);
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
                ? o.status === "no_realizada"
                  ? o
                  : { ...o, status: "cerrada" as const }
                : o,
            ),
            events,
          };
        });
      },
    }),
    [data, ready, account, sessionId],
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
  return crewSize * (a.perDiem || DEFAULT_LUNCH);
}
