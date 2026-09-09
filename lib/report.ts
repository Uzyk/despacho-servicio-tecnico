import {
  currentMonthKey,
  formatDayPretty,
  isoDate,
  monthKey,
  monthKeyTitle,
  shiftMonthKey,
} from "./calendar";
import {
  formatHours,
  hoursForStops,
  stopAssignees,
} from "./hours";
import { money } from "./ids";
import { companyNameOf } from "./install";
import { EVENT_LABEL, isRouteOpen, routePayout } from "./record";
import { stopLocality } from "./regions";
import { routeDates, stopDate } from "./routeDays";
import type { AppData, LogEvent, Stop } from "./types";

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function onRoute(data: AppData, routeId: string, technicianId: string) {
  const route = data.routes.find((r) => r.id === routeId);
  if (route?.leadId === technicianId) return true;
  return data.assignments.some(
    (a) => a.routeId === routeId && a.technicianId === technicianId,
  );
}

function stopInTechMonth(
  data: AppData,
  stop: Stop,
  technicianId: string,
  month: string,
) {
  const route = data.routes.find((r) => r.id === stop.routeId);
  if (!route || !onRoute(data, route.id, technicianId)) return false;
  if (monthKey(stopDate(stop, route)) !== month) return false;
  const assignees = stopAssignees(stop);
  if (assignees.length) return assignees.includes(technicianId);
  return true;
}

export function monthChoices(from: Date = new Date()) {
  const start = currentMonthKey(from);
  return Array.from({ length: 12 }, (_, i) => {
    const key = shiftMonthKey(start, -i);
    return { key, label: monthKeyTitle(key) };
  });
}

export function techMonthStops(
  data: AppData,
  technicianId: string,
  month: string,
) {
  return data.stops
    .filter((stop) => stopInTechMonth(data, stop, technicianId, month))
    .sort((a, b) => {
      const ra = data.routes.find((r) => r.id === a.routeId)!;
      const rb = data.routes.find((r) => r.id === b.routeId)!;
      const da = stopDate(a, ra);
      const db = stopDate(b, rb);
      return (
        da.localeCompare(db) ||
        a.routeId.localeCompare(b.routeId) ||
        a.order - b.order
      );
    });
}

export function techMonthEvents(
  data: AppData,
  technicianId: string,
  month: string,
): LogEvent[] {
  return (data.events ?? [])
    .filter(
      (e) =>
        e.technicianId === technicianId && monthKey(isoDate(new Date(e.at))) === month,
    )
    .sort((a, b) => a.at - b.at);
}

export function techMonthReport(
  data: AppData,
  technicianId: string,
  month: string,
) {
  const tech = data.technicians.find((t) => t.id === technicianId);
  const name = tech?.name ?? technicianId;
  const stops = techMonthStops(data, technicianId, month);
  const events = techMonthEvents(data, technicianId, month);
  const hourRows = hoursForStops(stops, data.progress ?? [], technicianId);
  const minutesByStop = new Map(hourRows.map((row) => [row.stop.id, row.minutes]));
  const minutes = hourRows.reduce((sum, row) => sum + row.minutes, 0);

  const jobs = stops.map((stop) => {
    const route = data.routes.find((r) => r.id === stop.routeId)!;
    const progress = (data.progress ?? []).find(
      (p) => p.stopId === stop.id && p.technicianId === technicianId,
    );
    return {
      date: stopDate(stop, route),
      routeId: stop.routeId,
      city: stopLocality(data, stop),
      workType: stop.workType,
      company: companyNameOf(stop),
      arrivedAt: progress?.arrivedAt ?? "",
      leftAt: progress?.leftAt ?? "",
      minutes: minutesByStop.get(stop.id) ?? 0,
      note: progress?.closeNote?.trim() ?? "",
      lead: route.leadId === technicianId,
    };
  });

  const uniqueRoutes = [
    ...new Set([
      ...jobs.map((job) => job.routeId),
      ...data.routes
        .filter(
          (route) =>
            onRoute(data, route.id, technicianId) &&
            routeDates(data, route).some((d) => monthKey(d) === month),
        )
        .map((route) => route.id),
    ]),
  ];
  const finished = uniqueRoutes.filter((id) => {
    const route = data.routes.find((r) => r.id === id);
    return route && !isRouteOpen(route);
  }).length;
  const viaticos = uniqueRoutes.reduce((sum, id) => {
    const route = data.routes.find((r) => r.id === id);
    if (!route || route.leadId !== technicianId) return sum;
    return sum + routePayout(data, id);
  }, 0);

  return {
    technicianId,
    name,
    month,
    period: monthKeyTitle(month),
    routes: uniqueRoutes.length,
    finished,
    bajas: events.filter((e) => e.kind === "baja").length,
    cubrio: events.filter((e) => e.kind === "entra").length,
    arrivals: events.filter((e) => e.kind === "llegada").length,
    minutes,
    hoursLabel: formatHours(minutes),
    viaticos,
    viaticosLabel: money(viaticos),
    jobs,
    events,
  };
}

export function downloadTechMonthReport(
  data: AppData,
  technicianId: string,
  month: string,
) {
  const report = techMonthReport(data, technicianId, month);
  const generated = new Date().toLocaleString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const jobRows = report.jobs
    .map(
      (job) => `<tr>
        <td>${esc(formatDayPretty(job.date))}</td>
        <td>${esc(job.routeId)}</td>
        <td>${esc(job.city)}</td>
        <td>${esc(job.workType)}</td>
        <td>${esc(job.company || "—")}</td>
        <td>${esc(job.arrivedAt || "—")}</td>
        <td>${esc(job.leftAt || "—")}</td>
        <td>${esc(formatHours(job.minutes))}</td>
        <td>${esc(job.note || "—")}</td>
      </tr>`,
    )
    .join("");
  const eventRows = report.events
    .map((e) => {
      const who = e.relatedTechnicianId
        ? (data.technicians.find((t) => t.id === e.relatedTechnicianId)?.name ?? "")
        : "";
      return `<tr>
        <td>${esc(
          new Date(e.at).toLocaleString("es-CL", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        )}</td>
        <td>${esc(EVENT_LABEL[e.kind])}</td>
        <td>${esc(e.routeId ?? "—")}</td>
        <td>${esc([e.note, who ? `con ${who}` : ""].filter(Boolean).join(" · ") || "—")}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe ${esc(report.name)} · ${esc(report.period)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #1c1917; margin: 32px; }
    h1 { color: #0f3a5f; margin: 0 0 4px; }
    h2 { color: #0f3a5f; font-size: 16px; margin: 28px 0 8px; }
    .gold { color: #c9a227; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; font-size: 12px; }
    .muted { color: #57534e; }
    .cards { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0 8px; }
    .card { background: #f5f5f4; border-radius: 12px; padding: 10px 14px; min-width: 120px; }
    .card span { display: block; font-size: 11px; color: #78716c; }
    .card strong { color: #0f3a5f; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e7e5e4; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { color: #0f3a5f; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <p class="gold">INACAP · Tecnologías aplicadas a los sistemas inteligentes</p>
  <h1>Informe mensual de desempeño</h1>
  <p class="muted">${esc(report.name)} · ${esc(report.technicianId)} · ${esc(report.period)}</p>
  <p class="muted">Generado ${esc(generated)}</p>
  <h2>Resumen</h2>
  <div class="cards">
    <div class="card"><span>Rutas</span><strong>${report.routes}</strong></div>
    <div class="card"><span>Finalizó</span><strong>${report.finished}</strong></div>
    <div class="card"><span>Horas</span><strong>${esc(report.hoursLabel)}</strong></div>
    <div class="card"><span>Llegadas</span><strong>${report.arrivals}</strong></div>
    <div class="card"><span>Bajas</span><strong>${report.bajas}</strong></div>
    <div class="card"><span>Cubrió</span><strong>${report.cubrio}</strong></div>
    <div class="card"><span>Viáticos</span><strong>${esc(report.viaticosLabel)}</strong></div>
  </div>
  <h2>Trabajos del mes</h2>
  ${
    report.jobs.length
      ? `<table>
        <thead><tr><th>Fecha</th><th>Ruta</th><th>Ciudad</th><th>Tipo</th><th>Empresa</th><th>Llegada</th><th>Salida</th><th>Permanencia</th><th>Nota</th></tr></thead>
        <tbody>${jobRows}</tbody>
      </table>`
      : `<p class="muted">Sin paradas en este mes.</p>`
  }
  <h2>Registro</h2>
  ${
    report.events.length
      ? `<table>
        <thead><tr><th>Cuándo</th><th>Hecho</th><th>Ruta</th><th>Detalle</th></tr></thead>
        <tbody>${eventRows}</tbody>
      </table>`
      : `<p class="muted">Sin movimientos en este mes.</p>`
  }
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = report.name.replace(/[^\wáéíóúñ]+/gi, "-").replace(/^-|-$/g, "");
  a.href = url;
  a.download = `informe-${slug || report.technicianId}-${month}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
