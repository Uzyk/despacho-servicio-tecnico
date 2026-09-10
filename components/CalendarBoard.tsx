"use client";

import { useMemo, useState } from "react";
import {
  isoDate,
  monthCells,
  monthTitle,
} from "@/lib/calendar";
import { isRouteOpen } from "@/lib/record";
import { formatRouteSpan, isRestDay, routesByActivityDate } from "@/lib/routeDays";
import { nameOf, useStore } from "@/lib/store";
import { RouteTimeline } from "./RouteTimeline";
import { GhostButton } from "./ui";

const WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function CalendarBoard({
  technicianId,
}: {
  technicianId?: string;
}) {
  const { data } = useStore();
  const now = new Date();
  const [cursor, setCursor] = useState({
    y: now.getFullYear(),
    m: now.getMonth(),
  });
  const [picked, setPicked] = useState<string | null>(null);
  const today = isoDate();

  const cells = useMemo(() => monthCells(cursor.y, cursor.m), [cursor]);
  const byDate = useMemo(
    () => routesByActivityDate(data, technicianId),
    [data, technicianId],
  );

  const selected = data.routes.find((r) => r.id === picked);

  function shift(delta: number) {
    setCursor((c) => {
      const next = new Date(c.y, c.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy">
            {technicianId ? "Mi calendario" : "Calendario de rutas"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <GhostButton type="button" onClick={() => shift(-1)}>
            Mes anterior
          </GhostButton>
          <p className="min-w-40 text-center text-sm font-semibold text-navy">
            {monthTitle(cursor.y, cursor.m)}
          </p>
          <GhostButton type="button" onClick={() => shift(1)}>
            Mes siguiente
          </GhostButton>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="grid min-w-[640px] grid-cols-7 border-b border-stone-200">
          {WEEK.map((label) => (
            <p
              key={label}
              className="px-2 py-2 text-center text-xs font-semibold tracking-wide text-stone-500 uppercase"
            >
              {label}
            </p>
          ))}
        </div>
        <div className="grid min-w-[640px] grid-cols-7">
          {cells.map((cell) => {
            const routes = byDate.get(cell.iso) ?? [];
            const isToday = cell.iso === today;
            return (
              <div
                key={cell.iso}
                className={`min-h-28 border-t border-r border-stone-100 p-2 last:border-r-0 ${
                  cell.inMonth ? "bg-white" : "bg-stone-50"
                } ${isToday ? "ring-2 ring-inset ring-gold" : ""}`}
              >
                <p
                  className={`mb-1 text-xs font-semibold ${
                    cell.inMonth ? "text-navy" : "text-stone-400"
                  }`}
                >
                  {cell.dayNum}
                </p>
                <div className="space-y-1">
                  {routes.map((route) => {
                    const open = isRouteOpen(route);
                    const rest = isRestDay(route, cell.iso);
                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => setPicked(route.id)}
                        className={`block w-full rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight font-semibold ${
                          picked === route.id
                            ? "bg-gold text-navy"
                            : rest
                              ? "bg-amber-100 text-amber-950"
                              : open
                                ? "bg-navy text-white"
                                : "bg-stone-200 text-stone-700"
                        }`}
                      >
                        {route.id}
                        {rest ? " · descanso" : ""}
                        <span className="block font-normal opacity-90">
                          {route.leadId
                            ? nameOf(data.technicians, route.leadId)
                            : "Sin asignar"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-navy">
            {selected.id} · {formatRouteSpan(data, selected)}
            {isRouteOpen(selected) ? " · abierta" : " · finalizada"}
          </p>
          <RouteTimeline data={data} route={selected} />
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
          Elige una ruta.
        </p>
      )}
    </section>
  );
}
