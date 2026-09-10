"use client";

import { useState } from "react";
import { currentMonthKey } from "@/lib/calendar";
import { formatHours } from "@/lib/hours";
import {
  activityBars,
  allTechStats,
  EVENT_LABEL,
  eventsByDay,
  formatWhen,
  fulfillmentSlices,
  hoursByLocation,
  techStats,
} from "@/lib/record";
import { downloadTechMonthReport, monthChoices } from "@/lib/report";
import { nameOf, useStore } from "@/lib/store";
import { BarChart, DonutChart } from "./Charts";
import { Field, GhostButton, Select } from "./ui";

export function PerformanceBoard({
  technicianId,
}: {
  technicianId?: string;
}) {
  const { data } = useStore();
  const rows = technicianId
    ? [techStats(data, technicianId)]
    : allTechStats(data);
  const months = monthChoices();
  const [openId, setOpenId] = useState(technicianId ?? "");
  const [month, setMonth] = useState(currentMonthKey);
  const personal = Boolean(technicianId);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-navy">
          {personal ? "Mi desempeño" : "Desempeño del personal"}
        </h2>
        {personal ? null : (
          <div className="w-56">
            <Field label="Mes del informe">
              <Select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {months.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((row) => {
          const open = personal || openId === row.technicianId;
          const slices = fulfillmentSlices(row);
          const donePct =
            row.assigned > 0
              ? Math.round((row.finished / row.assigned) * 100)
              : 0;
          return (
            <article
              key={row.technicianId}
              className={`rounded-xl border border-stone-200 bg-white p-4 shadow-sm ${
                open ? "lg:col-span-2" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    if (personal) return;
                    setOpenId(open ? "" : row.technicianId);
                  }}
                >
                  <h3 className="font-bold text-navy">
                    {nameOf(data.technicians, row.technicianId)}
                  </h3>
                  {personal ? null : (
                    <span className="text-xs font-semibold text-gold">
                      {open ? "Ocultar" : "Ver ficha"}
                    </span>
                  )}
                </button>
                {personal ? null : (
                  <GhostButton
                    type="button"
                    onClick={() =>
                      downloadTechMonthReport(data, row.technicianId, month)
                    }
                  >
                    Descargar informe
                  </GhostButton>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <Stat label="Rutas" value={String(row.assigned)} />
                <Stat label="Finalizó" value={String(row.finished)} />
                <Stat label="Bajas" value={String(row.bajas)} />
                <Stat label="Cubrió" value={String(row.cubrio)} />
                <Stat label="Llegadas" value={String(row.arrivals)} />
                <Stat label="Horas" value={formatHours(row.minutes)} />
              </dl>
              {open ? (
                <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <DonutChart
                      title="Cumplimiento de rutas"
                      slices={slices}
                      center={`${donePct}%`}
                    />
                    <BarChart title="Actividad" bars={activityBars(row)} />
                    <BarChart
                      title="Horas por locación"
                      bars={hoursByLocation(data, row.technicianId)}
                      format={formatHours}
                    />
                    <BarChart
                      title="Movimientos por día"
                      bars={eventsByDay(row.events)}
                    />
                  </div>
                  <ol className="max-h-56 space-y-2 overflow-auto text-sm">
                    {row.events.length === 0 ? (
                      <li className="text-stone-500">Sin movimientos.</li>
                    ) : (
                      row.events.map((e) => (
                        <li key={e.id}>
                          <p className="font-semibold text-navy">
                            {EVENT_LABEL[e.kind]}
                            {e.routeId ? ` · ${e.routeId}` : ""}
                          </p>
                          <p className="text-stone-600">{e.note}</p>
                          <p className="text-xs text-stone-400">
                            {formatWhen(e.at)}
                            {e.relatedTechnicianId
                              ? ` · con ${nameOf(data.technicians, e.relatedTechnicianId)}`
                              : ""}
                          </p>
                        </li>
                      ))
                    )}
                  </ol>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-semibold text-navy">{value}</dd>
    </div>
  );
}
