"use client";

import { formatRouteSpan } from "@/lib/routeDays";
import { installSummary } from "@/lib/install";
import { lodgingPlace, needsLodging } from "@/lib/lodging";
import { formatHours, hoursForStops } from "@/lib/hours";
import { EVENT_LABEL, finishedRoutes, formatWhen } from "@/lib/record";
import { nameOf, useStore } from "@/lib/store";
import { stopLocality } from "@/lib/regions";
import { CloseEvidence } from "./CloseEvidence";

export function HistoryBoard({
  technicianId,
}: {
  technicianId?: string;
}) {
  const { data } = useStore();
  const rows = finishedRoutes(data).filter((route) =>
    technicianId
      ? data.assignments.some(
          (a) => a.routeId === route.id && a.technicianId === technicianId,
        )
      : true,
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-navy">
          {technicianId ? "Mis rutas cerradas" : "Histórico de rutas"}
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          No hay rutas en el histórico.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((route) => {
            const stops = data.stops
              .filter((s) => s.routeId === route.id)
              .sort((a, b) => a.order - b.order);
            const crew = data.assignments.filter((a) => a.routeId === route.id);
            const events = (data.events ?? []).filter(
              (e) => e.routeId === route.id,
            );
            return (
              <article
                key={route.id}
                className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-semibold tracking-wide text-gold uppercase">
                  {route.id} · {formatRouteSpan(data, route)}
                </p>
                <h3 className="text-lg font-bold text-navy">
                  Encargado:{" "}
                  {route.leadId
                    ? nameOf(data.technicians, route.leadId)
                    : "Sin asignar"}
                </h3>
                <p className="text-sm text-stone-500">
                  Cerrada{" "}
                  {route.closedAt ? formatWhen(route.closedAt) : "—"}
                </p>
                <ol className="mt-3 space-y-2 text-sm">
                  {stops.map((s) => {
                    const proofs = (data.progress ?? []).filter(
                      (p) =>
                        p.stopId === s.id &&
                        (p.closeNote?.trim() || p.closePhoto),
                    );
                    return (
                      <li key={s.id}>
                        {s.order}. {stopLocality(data, s)} ·{" "}
                        {s.workType}
                        {needsLodging(s.workType) && lodgingPlace(s)
                          ? ` · ${lodgingPlace(s)}`
                          : ""}
                        {installSummary(s) ? ` · ${installSummary(s)}` : ""}
                        {proofs.map((p) => (
                          <CloseEvidence
                            key={p.id}
                            compact
                            who={nameOf(data.technicians, p.technicianId)}
                            note={p.closeNote}
                            photo={p.closePhoto}
                            outcome={p.outcome}
                            failReason={p.failReason}
                          />
                        ))}
                      </li>
                    );
                  })}
                </ol>
                <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm">
                  {crew.map((a) => {
                    const mins = hoursForStops(
                      stops,
                      data.progress,
                      a.technicianId,
                    ).reduce((sum, row) => sum + row.minutes, 0);
                    return (
                      <li key={a.id}>
                        {nameOf(data.technicians, a.technicianId)}
                        {a.technicianId === route.leadId ? " (encargado)" : ""}
                        {mins > 0 ? ` · ${formatHours(mins)}` : ""}
                      </li>
                    );
                  })}
                </ul>
                <ol className="mt-3 max-h-40 space-y-1 overflow-auto text-xs text-stone-600">
                  {events
                    .slice()
                    .sort((a, b) => a.at - b.at)
                    .map((e) => (
                      <li key={e.id}>
                        {formatWhen(e.at)} · {EVENT_LABEL[e.kind]} ·{" "}
                        {nameOf(data.technicians, e.technicianId)}
                        {e.note ? ` · ${e.note}` : ""}
                      </li>
                    ))}
                </ol>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
