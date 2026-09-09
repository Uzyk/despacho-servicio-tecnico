"use client";

import Link from "next/link";
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
import { Card, Field, GhostButton, PrimaryButton, Select } from "./ui";
import { StopCheckin } from "./StopCheckin";

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

export function TecnicoApp() {
  const { data, ready } = useStore();
  const [techId, setTechId] = useState(data.technicians[0]?.id ?? "T01");
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const actives = data.technicians.filter((t) => t.active);
  const selectedId = actives.some((t) => t.id === techId)
    ? techId
    : (actives[0]?.id ?? "");
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

  if (!ready) return <p className="p-8 text-stone-600">Cargando…</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gold">Técnico</p>
          <h1 className="text-2xl font-bold text-navy">Tu jornada</h1>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-navy"
        >
          Cambiar rol
        </Link>
      </header>

      <Card>
        <Field label="Soy">
          <Select
            value={selectedId}
            onChange={(e) => setTechId(e.target.value)}
          >
            {actives.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {openMine.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          {actives.find((t) => t.id === selectedId)?.name ?? "Este técnico"} no
          tiene una ruta abierta.
        </p>
      ) : (
        <>
          {totalMins > 0 ? (
            <section className="mt-5 rounded-2xl bg-navy p-5 text-white shadow-sm">
              <p className="text-sm text-blue-100">Horas registradas</p>
              <p className="mt-1 text-3xl font-bold">{formatHours(totalMins)}</p>
              <p className="mt-1 text-sm text-blue-100">
                {closedJobs} trabajo{closedJobs === 1 ? "" : "s"} con llegada y
                salida
              </p>
              <ul className="mt-4 space-y-2 border-t border-white/20 pt-3 text-sm">
                {detail
                  .filter((row) => row.minutes > 0)
                  .map((row) => (
                    <li key={row.stop.id} className="flex justify-between gap-3">
                      <span>
                        {stopLocality(data, row.stop)} ·{" "}
                        {row.progress?.arrivedAt}–{row.progress?.leftAt}
                      </span>
                      <span className="font-semibold">
                        {formatHours(row.minutes)}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-6 space-y-8">
            <p className="text-sm font-semibold text-navy">
              Itinerario · {formatDayPretty(focusDate)}
            </p>
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
    </div>
  );
}
