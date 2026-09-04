import { money } from "@/lib/ids";
import { nameOf, payout } from "@/lib/store";
import type { AppData, Route } from "@/lib/types";

export function RouteTimeline({
  data,
  route,
  compact,
}: {
  data: AppData;
  route: Route;
  compact?: boolean;
}) {
  const lead = nameOf(data.technicians, route.leadId);
  const stops = data.stops
    .filter((s) => s.routeId === route.id)
    .sort((a, b) => a.order - b.order);
  const assigns = data.assignments.filter((a) => a.routeId === route.id);
  const cash = assigns.reduce((sum, a) => sum + payout(a, route.leadId), 0);

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">
            {route.id} · {route.day}
          </p>
          <h3 className="text-lg font-bold text-navy">Encargado: {lead}</h3>
        </div>
        {cash > 0 ? (
          <p className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">
            Viáticos al encargado: {money(cash)}
          </p>
        ) : null}
      </div>

      <ol className="space-y-2">
        {stops.map((s, i) => {
          const loc = nameOf(data.locations, s.locationId);
          return (
            <li key={s.id} className="flex gap-3">
              <div className="flex w-8 flex-col items-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                  {s.order}
                </span>
                {i < stops.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-stone-300" />
                ) : null}
              </div>
              <div className="pb-3">
                <p className="font-semibold text-ink">{loc}</p>
                <p className="text-sm text-stone-600">
                  {s.workType}
                  {s.time ? ` · ${s.time}` : ""}
                </p>
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
            {assigns.map((a) => (
              <li key={a.id}>
                {nameOf(data.technicians, a.technicianId)}
                {a.technicianId === route.leadId ? " (encargado)" : ""} ·{" "}
                {nameOf(data.vehicles, a.vehicleId)} · {a.mode}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
