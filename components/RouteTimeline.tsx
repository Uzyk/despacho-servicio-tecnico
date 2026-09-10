import { formatDayPretty } from "@/lib/calendar";
import { stopClockHint } from "@/lib/eta";
import { formatHours, isLocationPing, stayMinutes, stopAssignees } from "@/lib/hours";
import { companyNameOf, installDetail } from "@/lib/install";
import { kitLine } from "@/lib/kit";
import { lodgingPlace, needsLodging } from "@/lib/lodging";
import { money } from "@/lib/ids";
import { routePayout, routeVehicleId } from "@/lib/record";
import { formatRouteSpan, isRestDay, routeDates, stopDate } from "@/lib/routeDays";
import { nameOf } from "@/lib/store";
import { stopLocality } from "@/lib/regions";
import { vehicleNameOf } from "@/lib/vehicles";
import type { AppData, Route, Stop } from "@/lib/types";

export function RouteTimeline({
  data,
  route,
  compact,
  onRemoveStop,
}: {
  data: AppData;
  route: Route;
  compact?: boolean;
  onRemoveStop?: (stopId: string) => void;
}) {
  const lead = route.leadId
    ? nameOf(data.technicians, route.leadId)
    : "Sin asignar";
  const stops = data.stops
    .filter((s) => s.routeId === route.id)
    .sort((a, b) => a.order - b.order);
  const days = routeDates(data, route);
  const lines: ({ kind: "rest"; date: string } | { kind: "stop"; date: string; stop: Stop })[] =
    [];
  for (const day of days) {
    if (isRestDay(route, day)) lines.push({ kind: "rest", date: day });
    for (const stop of stops.filter((s) => stopDate(s, route) === day)) {
      lines.push({ kind: "stop", date: day, stop });
    }
  }
  const assigns = data.assignments
    .filter((a) => a.routeId === route.id)
    .slice()
    .sort((a, b) => {
      if (a.technicianId === route.leadId) return -1;
      if (b.technicianId === route.leadId) return 1;
      return 0;
    });
  const cash = routePayout(data, route.id);
  const van = routeVehicleId(data, route.id);

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">
            {route.id} · {formatRouteSpan(data, route)}
          </p>
          <h3 className="text-lg font-bold text-navy">Encargado: {lead}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {van ? (
            <p className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-navy">
              {vehicleNameOf(data, van)}
              {assigns.length > 1 ? " · van juntos" : ""}
            </p>
          ) : null}
          {cash > 0 ? (
            <p className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">
              Viáticos al encargado: {money(cash)}
            </p>
          ) : null}
        </div>
      </div>

      <ol className="space-y-2">
        {lines.map((line, i) => {
          if (line.kind === "rest") {
            return (
              <li key={`rest-${line.date}`} className="flex gap-3">
                <div className="flex w-8 flex-col items-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-900">
                    D
                  </span>
                  {i < lines.length - 1 ? (
                    <span className="mt-1 w-px flex-1 bg-stone-300" />
                  ) : null}
                </div>
                <div className="pb-3">
                  <p className="font-semibold text-ink">Descanso</p>
                  <p className="text-sm text-stone-600">
                    {formatDayPretty(line.date)} · el equipo no trabaja
                  </p>
                </div>
              </li>
            );
          }
          const s = line.stop;
          const loc = stopLocality(data, s);
          const clockHint = stopClockHint(s);
          const kit = kitLine(
            data.workOrders?.find((order) => order.id === s.workOrderId),
          );
          return (
            <li key={s.id} className="flex gap-3">
              <div className="flex w-8 flex-col items-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                  {s.order}
                </span>
                {i < lines.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-stone-300" />
                ) : null}
              </div>
              <div className="pb-3">
                <p className="font-semibold text-ink">
                  {companyNameOf(s) || loc}
                </p>
                <p className="text-sm text-stone-600">
                  {days.length > 1 ? `${formatDayPretty(line.date)} · ` : ""}
                  {companyNameOf(s) ? `${loc} · ` : ""}
                  {s.workOrderId ? `${s.workOrderId} · ` : ""}
                  {s.workType}
                  {s.time ? ` · ${s.time}` : ""}
                  {needsLodging(s.workType) && lodgingPlace(s)
                    ? ` · ${lodgingPlace(s)}`
                    : ""}
                  {installDetail(s) ? ` · ${installDetail(s)}` : ""}
                  {kit ? ` · kit: ${kit}` : ""}
                  {isLocationPing(s.workType)
                    ? " · todos"
                    : stopAssignees(s).length
                      ? ` · ${stopAssignees(s)
                          .map((id) => nameOf(data.technicians, id))
                          .join(", ")}`
                      : " · sin asignar"}
                </p>
                {clockHint ? (
                  <p className="text-xs font-medium text-sky-800">
                    {clockHint}
                  </p>
                ) : null}
                {onRemoveStop ? (
                  <button
                    type="button"
                    className="mt-1 text-xs font-semibold text-red-700 underline"
                    onClick={() => onRemoveStop(s.id)}
                  >
                    {s.workOrderId ? `Quitar ${s.workOrderId} de la ruta` : "Quitar parada"}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {!compact && assigns.length > 0 ? (
        <div className="mt-2 border-t border-stone-100 pt-3">
          <p className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Quién va
          </p>
          <ul className="space-y-1 text-sm">
            {assigns.map((a) => {
              const mins = stops.reduce((sum, s) => {
                const p = (data.progress ?? []).find(
                  (x) => x.stopId === s.id && x.technicianId === a.technicianId,
                );
                return sum + stayMinutes(p);
              }, 0);
              return (
                <li key={a.id}>
                  {nameOf(data.technicians, a.technicianId)}
                  {a.technicianId === route.leadId ? " (encargado)" : ""}
                  {mins > 0 ? ` · ${formatHours(mins)}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
