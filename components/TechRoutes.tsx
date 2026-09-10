"use client";

import { isRouteOpen, techAssignedRoutes } from "@/lib/record";
import { useStore } from "@/lib/store";
import { RouteTimeline } from "./RouteTimeline";
import { PageTitle } from "./ui";

export function TechRoutes() {
  const { data, account } = useStore();
  const techId = account?.technicianId ?? "";
  const rows = techId ? techAssignedRoutes(data, techId) : [];

  return (
    <section className="space-y-4">
      <PageTitle
        title="Mis rutas"
        hint="Itinerario de las rutas donde estás asignado"
      />
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          Aún no tienes rutas asignadas.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((route) => (
            <div key={route.id} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {isRouteOpen(route) ? "Abierta" : "Finalizada"}
              </p>
              <RouteTimeline data={data} route={route} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
