"use client";

import { useState } from "react";
import Link from "next/link";
import { findOrCreateRouteId, money } from "@/lib/ids";
import { nameOf, payout, useStore } from "@/lib/store";
import {
  DAYS,
  WORK_TYPES,
  type Day,
  type Mode,
  type WorkType,
} from "@/lib/types";
import { RouteTimeline } from "./RouteTimeline";
import { Card, Field, GhostButton, Input, PrimaryButton, Select } from "./ui";

type Tab = "rutas" | "asignar" | "catalogos";

export function JefaturaApp() {
  const { data, ready, addStop, removeStop, assign, removeAssignment, addTechnician, addLocation, addVehicle, reset } =
    useStore();
  const [tab, setTab] = useState<Tab>("rutas");

  const [day, setDay] = useState<Day>("Lunes");
  const [leadId, setLeadId] = useState(data.technicians[0]?.id ?? "");
  const [locationId, setLocationId] = useState(data.locations[0]?.id ?? "");
  const [workType, setWorkType] = useState<WorkType>("Instalación y capacitación");
  const [time, setTime] = useState("08:00");

  const [routeId, setRouteId] = useState(data.routes[0]?.id ?? "");
  const [techId, setTechId] = useState(data.technicians[0]?.id ?? "");
  const [vehicleId, setVehicleId] = useState(data.vehicles[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("Individual");
  const [peopleVan, setPeopleVan] = useState(1);
  const [peopleRoute, setPeopleRoute] = useState(1);
  const [perDiem, setPerDiem] = useState(10000);

  const [newTech, setNewTech] = useState("");
  const [newLoc, setNewLoc] = useState("");
  const [newVan, setNewVan] = useState("");

  if (!ready) {
    return <p className="p-8 text-stone-600">Cargando despacho…</p>;
  }

  const actives = data.technicians.filter((t) => t.active);
  const currentLead = leadId || actives[0]?.id || "";
  const preview = data.routes.find((r) => r.day === day && r.leadId === currentLead);

  const selectedRoute = data.routes.find((r) => r.id === routeId);

  function onAddStop() {
    const { routeId: next } = findOrCreateRouteId(data, day, currentLead);
    addStop({
      day,
      leadId: currentLead,
      locationId,
      workType,
      time,
    });
    setRouteId(next);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gold">Jefatura</p>
          <h1 className="text-2xl font-bold text-navy">Despacho de servicio técnico</h1>
          <p className="mt-1 max-w-xl text-sm text-stone-600">
            Elige día y encargado, agrega locaciones en orden y después asigna quién viaja.
            El técnico consulta su ruta sin llamarte.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-navy">
            Cambiar rol
          </Link>
          <GhostButton onClick={reset}>Restablecer demo</GhostButton>
        </div>
      </header>

      <nav className="mb-6 grid grid-cols-3 gap-2">
        {(
          [
            ["rutas", "1. Armar ruta"],
            ["asignar", "2. Asignar gente"],
            ["catalogos", "3. Catálogos"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-xl px-3 py-3 text-sm font-semibold ${
              tab === id ? "bg-navy text-white" : "bg-white text-navy ring-1 ring-stone-200"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "rutas" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card
            title="Nueva parada"
            hint="Mismo día + mismo encargado = mismo ID. Otro encargado el mismo día abre otra ruta."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Día">
                <Select value={day} onChange={(e) => setDay(e.target.value as Day)}>
                  {DAYS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Encargado">
                <Select value={currentLead} onChange={(e) => setLeadId(e.target.value)}>
                  {actives.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Localidad">
                <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  {data.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tipo de trabajo">
                <Select
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value as WorkType)}
                >
                  {WORK_TYPES.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Hora en locación">
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            </div>
            <PrimaryButton className="mt-4 w-full" onClick={onAddStop} disabled={!currentLead}>
              Agregar a la ruta
            </PrimaryButton>
          </Card>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-navy">
              Vista previa {preview ? `(${preview.id})` : "(se crea al agregar la primera parada)"}
            </p>
            {preview ? (
              <RouteTimeline data={data} route={preview} compact />
            ) : (
              <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
                Aún no hay paradas para este día y encargado.
              </p>
            )}
            {preview
              ? data.stops
                  .filter((s) => s.routeId === preview.id)
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <div key={s.id} className="flex justify-end">
                      <button
                        className="text-xs text-red-700 underline"
                        onClick={() => removeStop(s.id)}
                      >
                        Quitar parada {s.order}
                      </button>
                    </div>
                  ))
              : null}
          </div>
        </div>
      ) : null}

      {tab === "asignar" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Asignar técnico a una ruta" hint="Si van varios, elige Grupal. La plata queda en la fila del encargado.">
            <div className="grid gap-3">
              <Field label="Ruta">
                <Select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
                  {data.routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r.day} · {nameOf(data.technicians, r.leadId)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Técnico">
                <Select value={techId} onChange={(e) => setTechId(e.target.value)}>
                  {actives.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Camioneta">
                <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                  {data.vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.plate ? ` (${v.plate})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Modalidad">
                <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                  <option>Individual</option>
                  <option>Grupal</option>
                </Select>
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="En el auto">
                  <Input
                    type="number"
                    min={1}
                    value={peopleVan}
                    onChange={(e) => setPeopleVan(Number(e.target.value))}
                  />
                </Field>
                <Field label="En la ruta">
                  <Input
                    type="number"
                    min={1}
                    value={peopleRoute}
                    onChange={(e) => setPeopleRoute(Number(e.target.value))}
                  />
                </Field>
                <Field label="Viático c/u">
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={perDiem}
                    onChange={(e) => setPerDiem(Number(e.target.value))}
                  />
                </Field>
              </div>
            </div>
            <PrimaryButton
              className="mt-4 w-full"
              disabled={!routeId}
              onClick={() =>
                assign({
                  routeId,
                  technicianId: techId,
                  vehicleId,
                  mode,
                  peopleInVan: peopleVan,
                  peopleOnRoute: peopleRoute,
                  perDiem,
                })
              }
            >
              Asignar
            </PrimaryButton>
          </Card>

          <div className="space-y-3">
            {selectedRoute ? <RouteTimeline data={data} route={selectedRoute} /> : null}
            {selectedRoute
              ? data.assignments
                  .filter((a) => a.routeId === selectedRoute.id)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-stone-200"
                    >
                      <span>
                        {nameOf(data.technicians, a.technicianId)}
                        {a.technicianId === selectedRoute.leadId
                          ? ` · lleva ${money(payout(a, selectedRoute.leadId))}`
                          : ""}
                      </span>
                      <button className="text-red-700 underline" onClick={() => removeAssignment(a.id)}>
                        Quitar
                      </button>
                    </div>
                  ))
              : null}
          </div>
        </div>
      ) : null}

      {tab === "catalogos" ? (
        <div className="grid gap-5 md:grid-cols-3">
          <Card title="Técnicos">
            <div className="mb-3 flex gap-2">
              <Input
                placeholder="Nombre"
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
              />
              <PrimaryButton
                onClick={() => {
                  addTechnician(newTech);
                  setNewTech("");
                }}
              >
                +
              </PrimaryButton>
            </div>
            <ul className="max-h-64 space-y-1 overflow-auto text-sm">
              {data.technicians.map((t) => (
                <li key={t.id}>
                  <span className="font-mono text-xs text-stone-500">{t.id}</span> {t.name}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Locaciones">
            <div className="mb-3 flex gap-2">
              <Input
                placeholder="Nueva ciudad"
                value={newLoc}
                onChange={(e) => setNewLoc(e.target.value)}
              />
              <PrimaryButton
                onClick={() => {
                  if (!newLoc.trim()) return;
                  addLocation({
                    name: newLoc.trim(),
                    zone: "Otra",
                    workType: "Instalación y capacitación",
                    equipment: 1,
                  });
                  setNewLoc("");
                }}
              >
                +
              </PrimaryButton>
            </div>
            <ul className="max-h-64 space-y-1 overflow-auto text-sm">
              {data.locations.map((l) => (
                <li key={l.id}>{l.name}</li>
              ))}
            </ul>
          </Card>
          <Card title="Camionetas">
            <div className="mb-3 flex gap-2">
              <Input
                placeholder="Partner 7"
                value={newVan}
                onChange={(e) => setNewVan(e.target.value)}
              />
              <PrimaryButton
                onClick={() => {
                  addVehicle(newVan, "");
                  setNewVan("");
                }}
              >
                +
              </PrimaryButton>
            </div>
            <ul className="max-h-64 space-y-1 overflow-auto text-sm">
              {data.vehicles.map((v) => (
                <li key={v.id}>{v.name}</li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-navy">Rutas armadas</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.routes.map((r) => (
            <RouteTimeline key={r.id} data={data} route={r} />
          ))}
        </div>
      </section>
    </div>
  );
}
