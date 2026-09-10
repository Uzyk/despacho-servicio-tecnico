"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatDayPretty,
  isoDate,
  monthCells,
  monthTitle,
  parseIso,
} from "@/lib/calendar";
import {
  formatRouteSpan,
  isRestDay,
  routeDates,
  stopDate,
} from "@/lib/routeDays";
import {
  formatHours,
  hoursForStops,
  isStopAssignedTo,
  stayMinutes,
} from "@/lib/hours";
import { money } from "@/lib/ids";
import {
  allowanceBreakdown,
  allowancesOf,
  routeHasOvernight,
} from "@/lib/allowances";
import { routeLive } from "@/lib/live";
import {
  formatWhen,
  hasAckedRoute,
  routePayout,
  routeVehicleId,
  techOpenRoutes,
} from "@/lib/record";
import type { AppData, Route } from "@/lib/types";
import { nameOf, useStore } from "@/lib/store";
import { stopLocality } from "@/lib/regions";
import { vehicleNameOf } from "@/lib/vehicles";
import { GhostButton, PageTitle, PrimaryButton } from "./ui";
import { OfflineBanner } from "./OfflineBanner";
import { StopCheckin } from "./StopCheckin";
import { CalendarBoard } from "./CalendarBoard";
import { HistoryBoard } from "./HistoryBoard";
import { PerformanceBoard } from "./PerformanceBoard";
import { TechHome } from "./TechHome";
import { PeopleDirectory } from "./PeopleDirectory";
import { TechRoutes } from "./TechRoutes";
import { TechShell, type TechTab } from "./TechShell";

const WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function routesByDate(data: AppData, routes: Route[]) {
  const map = new Map<string, Route[]>();
  for (const route of routes) {
    for (const iso of routeDates(data, route)) {
      const list = map.get(iso) ?? [];
      list.push(route);
      map.set(iso, list);
    }
  }
  return map;
}

function defaultFocusDate(dates: string[], today: string) {
  if (dates.includes(today)) return today;
  return dates.find((d) => d >= today) ?? dates[0] ?? today;
}

function TechRouteDay({
  route,
  techId,
  date,
}: {
  route: Route;
  techId: string;
  date: string;
}) {
  const { data, acknowledgeRoute } = useStore();
  const myAssign = data.assignments.find(
    (a) => a.routeId === route.id && a.technicianId === techId,
  );
  const acked = hasAckedRoute(data, route.id, techId);
  const cash =
    myAssign && techId === route.leadId ? routePayout(data, route.id) : 0;
  const overnight = routeHasOvernight(data, route.id);
  const allowanceLines =
    cash > 0
      ? allowanceBreakdown(
          allowancesOf(data, route),
          data.assignments.filter((a) => a.routeId === route.id).length || 1,
          overnight,
        )
      : [];
  const van = routeVehicleId(data, route.id);
  const dayStops = data.stops
    .filter((s) => s.routeId === route.id && stopDate(s, route) === date)
    .sort((a, b) => a.order - b.order);
  const rest = isRestDay(route, date);
  const routeMins = dayStops.reduce(
    (sum, s) =>
      sum +
      stayMinutes(
        data.progress.find(
          (p) => p.stopId === s.id && p.technicianId === techId,
        ),
      ),
    0,
  );

  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-semibold tracking-wide text-gold uppercase">
          {route.id} · {formatRouteSpan(data, route)}
        </p>
        <h2 className="text-xl font-bold text-navy">
          Encargado:{" "}
          {route.leadId ? nameOf(data.technicians, route.leadId) : "Sin asignar"}
        </h2>
        {myAssign ? (
          <p className="mt-1 text-sm text-stone-600">
            {vehicleNameOf(data, van)}
            {data.assignments.filter((a) => a.routeId === route.id).length > 1
              ? " · van juntos"
              : ""}
            {cash > 0 ? ` · viáticos ${money(cash)}` : ""}
            {routeMins > 0 ? ` · ${formatHours(routeMins)} este día` : ""}
          </p>
        ) : null}
        {allowanceLines.length > 0 ? (
          <p className="mt-1 text-xs text-stone-500">
            {allowanceLines
              .map((line) => `${line.label} ${money(line.amount)}`)
              .join(" · ")}
          </p>
        ) : null}
      </div>
      {!acked ? (
        <div className="space-y-3">
          <PrimaryButton
            type="button"
            className="w-full"
            onClick={() => acknowledgeRoute(route.id, techId)}
          >
            Ver itinerario
          </PrimaryButton>
        </div>
      ) : (
        <>
          {myAssign?.seenAt ? (
            <p className="text-sm text-stone-600">
              Visto {formatWhen(myAssign.seenAt)}
            </p>
          ) : null}
          {rest ? (
                <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
                  Descanso · {formatDayPretty(date)}
                </p>
          ) : null}
          {dayStops.map((stop) => (
            <StopCheckin key={stop.id} stop={stop} technicianId={techId} />
          ))}
          {!rest && dayStops.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
              Esta ruta no tiene paradas este día.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function TechCalendar({
  byDate,
  picked,
  onPick,
}: {
  byDate: Map<string, Route[]>;
  picked: string;
  onPick: (iso: string) => void;
}) {
  const today = isoDate();
  const focus = parseIso(picked);
  const [cursor, setCursor] = useState({
    y: focus.getFullYear(),
    m: focus.getMonth(),
  });

  useEffect(() => {
    const next = parseIso(picked);
    setCursor({ y: next.getFullYear(), m: next.getMonth() });
  }, [picked]);

  const cells = useMemo(
    () => monthCells(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  );

  function shift(delta: number) {
    setCursor((c) => {
      const next = new Date(c.y, c.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-navy">Otras fechas</h2>
        </div>
        <div className="flex items-center gap-2">
          <GhostButton type="button" onClick={() => shift(-1)}>
            Mes anterior
          </GhostButton>
          <p className="min-w-32 text-center text-sm font-semibold text-navy">
            {monthTitle(cursor.y, cursor.m)}
          </p>
          <GhostButton type="button" onClick={() => shift(1)}>
            Mes siguiente
          </GhostButton>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-stone-200">
          {WEEK.map((label) => (
            <p
              key={label}
              className="px-1 py-2 text-center text-[11px] font-semibold tracking-wide text-stone-500 uppercase"
            >
              {label}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const routes = byDate.get(cell.iso) ?? [];
            const has = routes.length > 0;
            const isToday = cell.iso === today;
            const isPicked = cell.iso === picked;
            return (
              <button
                key={cell.iso}
                type="button"
                disabled={!has}
                onClick={() => onPick(cell.iso)}
                className={`min-h-16 border-t border-r border-stone-100 p-1.5 text-left last:border-r-0 disabled:cursor-default ${
                  cell.inMonth ? "bg-white" : "bg-stone-50"
                } ${isToday ? "ring-2 ring-inset ring-gold" : ""} ${
                  isPicked ? "bg-amber-50" : ""
                }`}
              >
                <p
                  className={`mb-1 text-xs font-semibold ${
                    cell.inMonth ? "text-navy" : "text-stone-400"
                  }`}
                >
                  {cell.dayNum}
                </p>
                <div className="space-y-0.5">
                  {routes.map((route) => {
                    const rest = isRestDay(route, cell.iso);
                    return (
                      <span
                        key={route.id}
                        className={`block truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight ${
                          isPicked
                            ? "bg-gold text-navy"
                            : rest
                              ? "bg-amber-100 text-amber-950"
                              : "bg-navy text-white"
                        }`}
                      >
                        {route.id}
                        {rest ? " · D" : ""}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const TABS: TechTab[] = [
  "inicio",
  "hoy",
  "rutas",
  "calendario",
  "desempeno",
  "historial",
  "directorio",
];

function asTab(value?: string): TechTab {
  return TABS.includes(value as TechTab) ? (value as TechTab) : "inicio";
}

function TechItinerary({ techId }: { techId: string }) {
  const { data } = useStore();
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const selectedId = techId;
  const actives = data.technicians.filter((t) => t.active);
  const openMine = useMemo(() => {
    if (!selectedId) return [];
    return techOpenRoutes(data, selectedId).filter((route) => {
      const live = routeLive(data, route, Date.now());
      return live?.phase !== "cerrada";
    });
  }, [data, selectedId]);

  const byDate = useMemo(
    () => routesByDate(data, openMine),
    [data, openMine],
  );
  const allDates = useMemo(() => [...byDate.keys()].sort(), [byDate]);
  const today = isoDate();
  const focusDate =
    pickedDate && byDate.has(pickedDate)
      ? pickedDate
      : defaultFocusDate(allDates, today);
  const routesToday = byDate.get(focusDate) ?? [];
  const showCalendar = allDates.length > 1;

  useEffect(() => {
    setPickedDate(null);
  }, [selectedId]);

  const detail = useMemo(() => {
    if (!selectedId) return [];
    const stops = data.stops.filter(
      (s) =>
        openMine.some((r) => r.id === s.routeId) &&
        isStopAssignedTo(s, selectedId),
    );
    return hoursForStops(stops, data.progress, selectedId).sort(
      (a, b) =>
        a.stop.routeId.localeCompare(b.stop.routeId) ||
        a.stop.order - b.stop.order,
    );
  }, [data, openMine, selectedId]);

  const totalMins = detail.reduce((sum, row) => sum + row.minutes, 0);
  const closedJobs = detail.filter((row) => row.minutes > 0).length;

  return (
    <section className="space-y-5">
      <PageTitle
        title="Hoy en terreno"
        hint={`Itinerario · ${formatDayPretty(focusDate)}`}
      />
      {openMine.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          {actives.find((t) => t.id === selectedId)?.name ?? "Este técnico"} no
          tiene una ruta abierta.
        </p>
      ) : (
        <>
          {totalMins > 0 ? (
            <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Horas registradas
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-navy">
                {formatHours(totalMins)}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {closedJobs} trabajo{closedJobs === 1 ? "" : "s"} con llegada y
                salida
              </p>
              <ul className="mt-4 space-y-2 border-t border-stone-100 pt-3 text-sm">
                {detail
                  .filter((row) => row.minutes > 0)
                  .map((row) => (
                    <li key={row.stop.id} className="flex justify-between gap-3">
                      <span>
                        {stopLocality(data, row.stop)} ·{" "}
                        {row.progress?.arrivedAt}–{row.progress?.leftAt}
                      </span>
                      <span className="font-semibold text-navy">
                        {formatHours(row.minutes)}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <div className="space-y-8">
            {routesToday.map((route) => (
              <TechRouteDay
                key={route.id}
                route={route}
                techId={selectedId}
                date={focusDate}
              />
            ))}
            {showCalendar ? (
              <TechCalendar
                byDate={byDate}
                picked={focusDate}
                onPick={setPickedDate}
              />
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

export function TecnicoApp({ initialTab }: { initialTab?: string }) {
  const { ready, account } = useStore();
  const [tab, setTab] = useState<TechTab>(() => asTab(initialTab));
  const [dirQuery, setDirQuery] = useState("");
  const techId = account?.technicianId ?? "";

  if (!ready) return <p className="p-8 text-stone-600">Cargando…</p>;

  return (
    <TechShell
      tab={tab}
      onTab={setTab}
      onSearch={(query) => {
        setDirQuery(query);
        setTab("directorio");
      }}
    >
      <OfflineBanner />
      {!techId ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          Esta cuenta no está vinculada a un técnico.
        </p>
      ) : (
        <>
          {tab === "inicio" ? <TechHome onOpenTab={setTab} /> : null}
          {tab === "hoy" ? <TechItinerary techId={techId} /> : null}
          {tab === "rutas" ? <TechRoutes /> : null}
          {tab === "calendario" ? (
            <CalendarBoard technicianId={techId} />
          ) : null}
          {tab === "desempeno" ? (
            <PerformanceBoard technicianId={techId} />
          ) : null}
          {tab === "historial" ? <HistoryBoard technicianId={techId} /> : null}
          {tab === "directorio" ? (
            <PeopleDirectory initialQuery={dirQuery} />
          ) : null}
        </>
      )}
    </TechShell>
  );
}
