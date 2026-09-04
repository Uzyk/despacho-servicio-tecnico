"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { money } from "@/lib/ids";
import { nameOf, payout, useStore } from "@/lib/store";
import { RouteTimeline } from "./RouteTimeline";
import { Card, Field, Select } from "./ui";

export function TecnicoApp() {
  const { data, ready } = useStore();
  const [techId, setTechId] = useState("T05");

  const mine = useMemo(() => {
    const assigns = data.assignments.filter((a) => a.technicianId === techId);
    const routeIds = [...new Set(assigns.map((a) => a.routeId))];
    return routeIds
      .map((id) => data.routes.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }, [data, techId]);

  if (!ready) return <p className="p-8 text-stone-600">Cargando…</p>;

  const me = data.technicians.find((t) => t.id === techId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gold">Técnico</p>
          <h1 className="text-2xl font-bold text-navy">Tu jornada</h1>
          <p className="mt-1 text-sm text-stone-600">
            Elige tu nombre. Aquí ves a dónde ir, en qué orden, con qué auto y quién lleva la plata.
          </p>
        </div>
        <Link href="/" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-navy">
          Cambiar rol
        </Link>
      </header>

      <Card>
        <Field label="Soy">
          <Select value={techId} onChange={(e) => setTechId(e.target.value)}>
            {data.technicians
              .filter((t) => t.active)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
      </Card>

      <div className="mt-6 space-y-4">
        {mine.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
            {me?.name ?? "Este técnico"} no tiene rutas asignadas. Jefatura debe asignarlo en el paso 2.
          </p>
        ) : (
          mine.map((route) => {
            const myAssign = data.assignments.find(
              (a) => a.routeId === route.id && a.technicianId === techId,
            );
            const cash = myAssign ? payout(myAssign, route.leadId) : 0;
            return (
              <div key={route.id} className="space-y-2">
                <RouteTimeline data={data} route={route} />
                {myAssign ? (
                  <p className="px-1 text-sm text-stone-600">
                    Vas en {nameOf(data.vehicles, myAssign.vehicleId)} · {myAssign.mode}
                    {cash > 0 ? ` · te entregan ${money(cash)} para viáticos del equipo` : ""}
                    {techId !== route.leadId
                      ? ` · el encargado es ${nameOf(data.technicians, route.leadId)}`
                      : ""}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
