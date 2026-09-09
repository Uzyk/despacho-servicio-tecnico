"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { formatRouteSpan } from "@/lib/routeDays";
import { formatGps, livePins } from "@/lib/geo";
import { installDetail, timeIsDeparture } from "@/lib/install";
import { lodgingPlace, needsLodging } from "@/lib/lodging";
import { formatHours, isStopAssignedTo, stopAssignees } from "@/lib/hours";
import { hasAckedRoute, pendingAcks, routeVehicleId } from "@/lib/record";
import {
  liveRoutes,
  PHASE_LABEL,
  ROUTE_PHASE_LABEL,
  type RouteLive,
  type TechLive,
} from "@/lib/live";
import { nameOf, useStore } from "@/lib/store";
import { stopLocality } from "@/lib/regions";
import { vehicleNameOf } from "@/lib/vehicles";
import { PrimaryButton } from "./ui";
import { CloseEvidence } from "./CloseEvidence";
import { ReplaceForm } from "./ReplaceForm";

const LiveMap = dynamic(
  () => import("./LiveMap").then((mod) => mod.LiveMap),
  {
    ssr: false,
    loading: () => (
      <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
        Cargando mapa GPS…
      </p>
    ),
  },
);

function useNowMs() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function LiveBoard() {
  const { data } = useStore();
  const nowMs = useNowMs();
  const rows = liveRoutes(data, nowMs);
  const pins = livePins(data, rows, nowMs);
  const active = rows.filter((row) => row.phase !== "cerrada");
  const closed = rows.filter((row) => row.phase === "cerrada");
  const inField = rows.filter((row) => row.phase === "en_curso").length;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-navy p-5 text-white shadow-sm">
        <p className="text-3xl font-bold">
          {inField} ruta{inField === 1 ? "" : "s"} en terreno
        </p>
      </div>

      <LiveMap pins={pins} />

      {active.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          No hay rutas activas.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {active.map((row) => (
            <LiveRouteCard key={row.route.id} row={row} />
          ))}
        </div>
      )}

      {closed.length > 0 ? (
        <details className="rounded-2xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-navy">
            Rutas cerradas ({closed.length})
          </summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {closed.map((row) => (
              <LiveRouteCard key={row.route.id} row={row} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function LiveRouteCard({ row }: { row: RouteLive }) {
  const { data, finishRoute } = useStore();
  const [swapId, setSwapId] = useState("");
  const waitingAck = pendingAcks(data, row.route.id).length;
  const tone =
    row.phase === "en_curso"
      ? "bg-amber-50 text-amber-900"
      : row.phase === "cerrada"
        ? "bg-emerald-50 text-emerald-800"
        : "bg-stone-100 text-stone-600";

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">
            {row.route.id} · {formatRouteSpan(data, row.route)}
          </p>
          <h3 className="text-lg font-bold text-navy">
            Encargado:{" "}
            {row.route.leadId
              ? nameOf(data.technicians, row.route.leadId)
              : "Sin asignar"}
          </h3>
          {waitingAck > 0 ? (
            <p className="mt-1 text-xs font-medium text-amber-800">
              {waitingAck} sin acuse del itinerario
            </p>
          ) : null}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
          {row.phase === "en_curso" ? (
            <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-600" />
          ) : null}
          {ROUTE_PHASE_LABEL[row.phase]}
        </span>
      </div>

      <ol className="mb-4 space-y-2">
        {row.stops.map((stop) => (
          <li key={stop.id} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
              {stop.order}
            </span>
            <div>
              <p className="font-semibold text-ink">
                {stop.companyName?.trim() ||
                  stopLocality(data, stop)}
              </p>
              <p className="text-stone-500">
                {stop.companyName?.trim()
                  ? `${stopLocality(data, stop)} · `
                  : ""}
                {stop.workType}
                {needsLodging(stop.workType) && lodgingPlace(stop)
                  ? ` · ${lodgingPlace(stop)}`
                  : ""}
                {installDetail(stop) ? ` · ${installDetail(stop)}` : ""}
                {stop.time
                  ? timeIsDeparture(stop.workType)
                    ? ` · salir ${stop.time}`
                    : ` · plan ${stop.time}`
                  : ""}
                {stopAssignees(stop).length
                  ? ` · ${stopAssignees(stop)
                      .map((id) => nameOf(data.technicians, id))
                      .join(", ")}`
                  : " · todos"}
              </p>
              <StopMarks row={row} stopId={stop.id} />
            </div>
          </li>
        ))}
      </ol>

      <ul className="space-y-3 border-t border-stone-100 pt-3">
        {row.techs.map((tech) => (
          <li key={tech.technicianId}>
            <TechLine tech={tech} routeId={row.route.id} />
            {swapId === tech.technicianId ? (
              <ReplaceForm
                routeId={row.route.id}
                fromId={tech.technicianId}
                onDone={() => setSwapId("")}
              />
            ) : (
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-navy underline"
                onClick={() => setSwapId(tech.technicianId)}
              >
                Reemplazar
              </button>
            )}
          </li>
        ))}
      </ul>

      <PrimaryButton
        type="button"
        className="mt-4 w-full"
        onClick={() => finishRoute(row.route.id)}
      >
        Finalizar ruta y guardar en histórico
      </PrimaryButton>
    </article>
  );
}

function StopMarks({ row, stopId }: { row: RouteLive; stopId: string }) {
  const { data } = useStore();
  const stop = row.stops.find((s) => s.id === stopId);
  const bits = row.techs
    .filter((tech) => !stop || isStopAssignedTo(stop, tech.technicianId))
    .map((tech) => {
      const p = (data.progress ?? []).find(
        (x) => x.stopId === stopId && x.technicianId === tech.technicianId,
      );
      if (!p?.arrivedAt) return null;
      const name = nameOf(data.technicians, tech.technicianId);
      const gps = formatGps(p.arrivedLat, p.arrivedLng);
      const gpsBit = gps ? ` · GPS ${gps}` : "";
      if (p.leftAt) return `${name} ${p.arrivedAt}–${p.leftAt}${gpsBit}`;
      return `${name} llegó ${p.arrivedAt}${gpsBit}`;
    })
    .filter(Boolean);
  const proofs = row.techs
    .filter((tech) => !stop || isStopAssignedTo(stop, tech.technicianId))
    .map((tech) => {
      const p = (data.progress ?? []).find(
        (x) => x.stopId === stopId && x.technicianId === tech.technicianId,
      );
      if (!p?.closeNote && !p?.closePhoto) return null;
      return (
        <CloseEvidence
          key={tech.technicianId}
          compact
          who={nameOf(data.technicians, tech.technicianId)}
          note={p?.closeNote}
          photo={p?.closePhoto}
        />
      );
    })
    .filter(Boolean);
  if (bits.length === 0 && proofs.length === 0) return null;
  return (
    <div className="mt-1">
      {bits.length > 0 ? (
        <p className="text-xs text-stone-600">{bits.join(" · ")}</p>
      ) : null}
      {proofs}
    </div>
  );
}

function TechLine({ tech, routeId }: { tech: TechLive; routeId: string }) {
  const { data } = useStore();
  const hereStop = tech.stopId
    ? data.stops.find((s) => s.id === tech.stopId)
    : undefined;
  const nextStop = tech.nextStopId
    ? data.stops.find((s) => s.id === tech.nextStopId)
    : undefined;
  const here = hereStop ? stopLocality(data, hereStop) : "";
  const next = nextStop ? stopLocality(data, nextStop) : "";

  let detail = hasAckedRoute(data, routeId, tech.technicianId)
    ? "Aún no marca llegada"
    : "Todavía no vio el itinerario";
  if (tech.phase === "en_locacion") {
    detail = `Trabajando en ${here} desde ${tech.arrivedAt}`;
    if (tech.tasksTotal > 0) {
      detail += ` · ${tech.tasksDone}/${tech.tasksTotal} tareas`;
    }
  } else if (tech.phase === "llego") {
    detail = `Llegó bien a ${here} a las ${tech.arrivedAt}`;
    if (next) detail += ` · sigue ${next}`;
  } else if (tech.phase === "pernocta") {
    detail = `Pernocta en ${here} desde ${tech.arrivedAt}`;
  } else if (tech.phase === "en_transito") {
    detail = next ? `Va hacia ${next}` : "En tránsito";
    if (here) detail += ` · salió de ${here}`;
  } else if (tech.phase === "terminada") {
    detail = `Cerró en ${here || "la última parada"}`;
  }

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
      <div>
        <p className="font-semibold text-navy">
          {nameOf(data.technicians, tech.technicianId)}
          <span className="ml-2 font-normal text-stone-500">
            {PHASE_LABEL[tech.phase]} ·{" "}
            {vehicleNameOf(data, routeVehicleId(data, routeId) || tech.vehicleId)}
          </span>
        </p>
        <p className="text-stone-600">{detail}</p>
      </div>
      <p className="font-semibold text-navy">
        {tech.minutes > 0 ? formatHours(tech.minutes) : "—"}
      </p>
    </div>
  );
}
