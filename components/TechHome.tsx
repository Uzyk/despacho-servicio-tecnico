"use client";

import { formatHours } from "@/lib/hours";
import { ROLE_LABEL } from "@/lib/auth";
import {
  EVENT_LABEL,
  formatWhen,
  hasAckedRoute,
  techAssignedRoutes,
  techOpenRoutes,
  techStats,
} from "@/lib/record";
import { formatRouteSpan } from "@/lib/routeDays";
import { nameOf, useStore } from "@/lib/store";
import type { TechTab } from "./TechShell";
import {
  MonthBanner,
  PersonRow,
  PortalCard,
  PortalHeroCard,
  PortalSection,
  ProgressRing,
  TaskRow,
} from "./PortalDash";

export function TechHome({
  onOpenTab,
}: {
  onOpenTab: (tab: TechTab) => void;
}) {
  const { data, account } = useStore();
  const techId = account?.technicianId ?? "";
  if (!account || !techId) return null;

  const stats = techStats(data, techId);
  const open = techOpenRoutes(data, techId);
  const assigned = techAssignedRoutes(data, techId);
  const donePct =
    stats.assigned > 0 ? Math.round((stats.finished / stats.assigned) * 100) : 0;
  const pending = open
    .filter((route) => !hasAckedRoute(data, route.id, techId))
    .map((route) => ({
      id: route.id,
      label: `Ver itinerario ${route.id}`,
    }));
  if (open.length && pending.length === 0) {
    pending.push({ id: "hoy", label: "Registrar llegada en terreno" });
  }
  const team = (data.accounts ?? [])
    .filter((person) => person.role === "tecnico" && person.id !== account.id)
    .slice(0, 4);
  const recent = stats.events.slice(0, 4);

  return (
    <section className="space-y-8">
      <PortalSection title="Saludo">
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
          <PortalHeroCard
            name={account.name}
            title={`${account.title} · ${ROLE_LABEL[account.role]}`}
          />
        </div>
      </PortalSection>

      <PortalSection title="Tu jornada">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <PortalCard title="Ruta en curso">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm leading-relaxed text-stone-600">
                {open.length
                  ? `Tienes ${open.length} ruta${open.length === 1 ? "" : "s"} abierta${open.length === 1 ? "" : "s"}. Este es el avance de tus asignaciones.`
                  : "Hoy no tienes una ruta abierta. Revisa el calendario o el directorio si necesitas contactar a jefatura."}
              </p>
            </div>
            <div className="text-center">
              <ProgressRing value={donePct} />
              <p className="mt-1 text-xs font-medium text-stone-500">
                Avance general
              </p>
              <p className="text-xs text-stone-400">
                {stats.finished} de {stats.assigned} finalizadas
              </p>
            </div>
          </div>
          {open.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-stone-100 pt-3 text-sm">
              {open.map((route) => (
                <li key={route.id}>
                  <p className="font-semibold text-navy">{route.id}</p>
                  <p className="text-stone-500">
                    {formatRouteSpan(data, route)}
                    {route.leadId
                      ? ` · ${nameOf(data.technicians, route.leadId)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </PortalCard>

        <PortalCard title="Tareas pendientes">
          {pending.length === 0 ? (
            <p className="text-sm text-stone-500">No hay tareas pendientes.</p>
          ) : (
            <div className="space-y-1">
              {pending.map((item, i) => (
                <TaskRow
                  key={item.id}
                  index={i + 1}
                  label={item.label}
                  onClick={() => onOpenTab("hoy")}
                />
              ))}
            </div>
          )}
        </PortalCard>
      </div>
      </PortalSection>

      <PortalSection title="Equipo y mes">
      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <PortalCard title="Equipo">
          {team.length === 0 ? (
            <p className="text-sm text-stone-500">Sin otros técnicos.</p>
          ) : (
            <ul>
              {team.map((person) => (
                <PersonRow
                  key={person.id}
                  photo={person.photo}
                  name={person.name}
                  hint={person.title}
                />
              ))}
            </ul>
          )}
        </PortalCard>

        <MonthBanner
          message={`Este mes llevas ${formatHours(stats.minutes)} en terreno y ${stats.arrivals} llegada${stats.arrivals === 1 ? "" : "s"}. ${assigned.length} ruta${assigned.length === 1 ? "" : "s"} en tu itinerario.`}
        />

      </div>
      </PortalSection>

      <PortalSection title="Actividad reciente">
        <PortalCard title="Actividad">
          {recent.length === 0 ? (
            <p className="text-sm text-stone-500">Aún no hay movimientos.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((event) => (
                <li key={event.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 text-gold">★</span>
                  <span>
                    <span className="font-medium text-navy">
                      {EVENT_LABEL[event.kind]}
                    </span>
                    {event.routeId ? ` · ${event.routeId}` : ""}
                    <span className="block text-xs text-stone-400">
                      {formatWhen(event.at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </PortalSection>
    </section>
  );
}
