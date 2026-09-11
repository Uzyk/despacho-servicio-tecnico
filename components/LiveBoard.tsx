"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { formatDayPretty, isoDate } from "@/lib/calendar";
import { formatGps, livePins } from "@/lib/geo";
import { installDetail, timeIsDeparture } from "@/lib/install";
import { lodgingPlace, needsLodging } from "@/lib/lodging";
import { formatHours, isStopAssignedTo, stopAssignees } from "@/lib/hours";
import { pendingWorkOrders } from "@/lib/orders";
import { vehicleDutyOf } from "@/lib/availability";
import { avatarDataUrl } from "@/lib/auth";
import { hasAckedRoute, assignmentsOnOpenRoutes, openRoutes, pendingAcks, routeVehicleId } from "@/lib/record";
import { formatRouteSpan } from "@/lib/routeDays";
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
import type { JefaturaTab } from "./AppShell";
import { PrimaryButton } from "./ui";
import { CloseEvidence } from "./CloseEvidence";
import { ReplaceForm } from "./ReplaceForm";
import {
  MonthBanner,
  PersonRow,
  PortalCard,
  PortalHeroCard,
  PortalSection,
  ProgressRing,
  TaskRow,
} from "./PortalDash";

const LiveMap = dynamic(
  () => import("./LiveMap").then((mod) => mod.LiveMap),
  {
    ssr: false,
    loading: () => (
      <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
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

export function LiveBoard({
  onOpenTab,
}: {
  onOpenTab?: (tab: JefaturaTab) => void;
}) {
  const { data, account } = useStore();
  const nowMs = useNowMs();
  const rows = liveRoutes(data, nowMs);
  const pins = livePins(data, rows, nowMs);
  const active = rows.filter((row) => row.phase !== "cerrada");
  const closed = rows.filter((row) => row.phase === "cerrada");
  const inField = rows.filter((row) => row.phase === "en_curso").length;
  const waiting = active.reduce(
    (n, row) => n + pendingAcks(data, row.route.id).length,
    0,
  );
  const otOpen = pendingWorkOrders(data).length;
  const vansField = data.vehicles.filter(
    (v) => vehicleDutyOf(data, v.id) === "en_terreno",
  ).length;
  const assigned = new Set(
    data.assignments
      .filter((a) => openRoutes(data).some((r) => r.id === a.routeId))
      .map((a) => a.technicianId),
  );
  const techsFree = data.technicians.filter(
    (t) => t.active && !assigned.has(t.id),
  ).length;
  const techsOut = data.technicians.filter(
    (t) => t.active && assigned.has(t.id),
  ).length;

  const team = assignmentsOnOpenRoutes(data).map((row) => ({
    technicianId: row.technicianId,
    routeId: row.routeId,
    name: nameOf(data.technicians, row.technicianId),
    photo:
      data.accounts.find((a) => a.technicianId === row.technicianId)?.photo ||
      avatarDataUrl(nameOf(data.technicians, row.technicianId)),
  }));
  const tasks: { id: string; label: string; tab: JefaturaTab }[] = [];
  if (otOpen > 0) {
    tasks.push({ id: "ot", label: `${otOpen} OT sin asignar`, tab: "ot" });
  }
  if (waiting > 0) {
    tasks.push({
      id: "ack",
      label: `${waiting} itinerario${waiting === 1 ? "" : "s"} sin acuse`,
      tab: "armadas",
    });
  }
  if (techsFree > 0) {
    tasks.push({
      id: "crew",
      label: `${techsFree} técnico${techsFree === 1 ? "" : "s"} disponible${techsFree === 1 ? "" : "s"}`,
      tab: "asignar",
    });
  }
  const cover =
    active.length > 0
      ? Math.round((inField / active.length) * 100)
      : 0;

  return (
    <section className="space-y-8">
      <PortalSection title="Saludo">
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
          {account ? (
            <PortalHeroCard
              name={account.name}
              title={`${account.title} · ${formatDayPretty(isoDate())}`}
            />
          ) : (
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-navy">
                Operaciones
              </h1>
              <p className="mt-0.5 text-sm text-stone-500">
                {formatDayPretty(isoDate())} · seguimiento en vivo
              </p>
            </div>
          )}
        </div>
      </PortalSection>

      <PortalSection title="Jornada">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <PortalCard title="Jornada en curso">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm leading-relaxed text-stone-600">
                {active.length
                  ? `${inField} ruta${inField === 1 ? "" : "s"} en terreno de ${active.length} abierta${active.length === 1 ? "" : "s"}.`
                  : "No hay rutas abiertas en este momento."}
              </p>
            </div>
            <div className="text-center">
              <ProgressRing value={cover} />
              <p className="mt-1 text-xs font-medium text-stone-500">
                Avance general
              </p>
            </div>
          </div>
        </PortalCard>
        <PortalCard title="Tareas pendientes">
          {tasks.length === 0 ? (
            <p className="text-sm text-stone-500">Todo al día.</p>
          ) : (
            tasks.map((item, i) => (
              <TaskRow
                key={item.id}
                index={i + 1}
                label={item.label}
                onClick={() => onOpenTab?.(item.tab)}
              />
            ))
          )}
        </PortalCard>
      </div>
      </PortalSection>

      <PortalSection title="Equipo">
      <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <PortalCard title="Equipo en terreno">
          {team.length === 0 ? (
            <p className="text-sm text-stone-500">Nadie en ruta.</p>
          ) : (
            <ul>
              {team.map((person) => (
                <PersonRow
                  key={`${person.technicianId}-${person.routeId}`}
                  photo={person.photo}
                  name={person.name}
                  hint={`${person.technicianId} · ${person.routeId}`}
                />
              ))}
            </ul>
          )}
        </PortalCard>
        <MonthBanner message="Resalta el cumplimiento de rutas y el acuse de itinerario. El mapa de abajo muestra la operación en vivo." />
      </div>
      </PortalSection>

      <PortalSection title="Indicadores">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="En terreno"
          value={String(inField)}
          hint={`${active.length} ruta${active.length === 1 ? "" : "s"} abierta${active.length === 1 ? "" : "s"}`}
        />
        <Kpi
          label="OT pendientes"
          value={String(otOpen)}
          hint="Sin asignar a una ruta"
          onClick={onOpenTab ? () => onOpenTab("ot") : undefined}
        />
        <Kpi
          label="Cuadrilla"
          value={`${techsOut} / ${techsOut + techsFree}`}
          hint={`${techsFree} disponible${techsFree === 1 ? "" : "s"}`}
          onClick={onOpenTab ? () => onOpenTab("asignar") : undefined}
        />
        <Kpi
          label="Vehículos en ruta"
          value={String(vansField)}
          hint={waiting > 0 ? `${waiting} sin acuse` : "Itinerarios vistos"}
          onClick={onOpenTab ? () => onOpenTab("catalogos") : undefined}
        />
      </div>
      </PortalSection>

      <PortalSection title="Operación en vivo">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
        <LiveMap pins={pins} tall />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">Rutas activas</h2>
            <span className="text-xs text-stone-500">{active.length}</span>
          </div>
          {active.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
              No hay rutas activas.
            </p>
          ) : (
            <div className="grid gap-3">
              {active.map((row) => (
                <LiveRouteCard key={row.route.id} row={row} />
              ))}
            </div>
          )}
        </div>
      </div>
      </PortalSection>

      {closed.length > 0 ? (
        <details className="rounded-xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-navy">
            Rutas cerradas ({closed.length})
          </summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {closed.map((row) => (
              <LiveRouteCard key={row.route.id} row={row} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  onClick?: () => void;
}) {
  const className =
    "rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm";
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-navy">
        {value}
      </p>
      <p className="mt-1 text-xs text-stone-500">{hint}</p>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} transition hover:border-navy/30`}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
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
    <article className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
            {row.route.id} · {formatRouteSpan(data, row.route)}
          </p>
          <h3 className="text-base font-semibold text-navy">
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
