"use client";

import { useState } from "react";
import Link from "next/link";
import {
  dayFromIso,
  formatDayPretty,
  isoDate,
  nearestWorkday,
} from "@/lib/calendar";
import {
  canRestOn,
  continuableOpenRoutes,
  formatRouteSpan,
  isRestDay,
  sameDayOpenRoutes,
  selectableOpenRoute,
} from "@/lib/routeDays";
import { money } from "@/lib/ids";
import {
  installAddressOf,
  installKindOf,
  installStatusOf,
  hasSiteAddress,
  isDispatchWork,
  isReturnToBase,
  needsCompany,
  companyNameOf,
  timeFieldLabel,
  timeIsDeparture,
} from "@/lib/install";
import { lodgingPlace, lodgingStatusOf, LODGING_LABEL, needsLodging } from "@/lib/lodging";
import { isLocationPing } from "@/lib/hours";
import {
  freeTechniciansForRoute,
  leadCandidatesForRoute,
} from "@/lib/availability";
import {
  crewIds,
  formatWhen,
  hasAckedRoute,
  openRoutes,
  routePayout,
} from "@/lib/record";
import { nameOf, useStore } from "@/lib/store";
import { operativeVehicles, vehicleLabel } from "@/lib/vehicles";
import {
  JOB_TYPES,
  TRAVEL_TYPES,
  type Day,
  type WorkType,
} from "@/lib/types";
import {
  BASE_POINT,
  destForDraft,
  lastWorkOrigin,
  originForRoute,
  stopClockHint,
  type EtaResult,
} from "@/lib/eta";
import { BASE_COORDS, BASE_LOCATION_ID, coordsOf } from "@/lib/geo";
import type { PlaceHit } from "@/lib/places";
import {
  catalogRegions,
  localityOfPlace,
  regionIdOfPlace,
  stopLocality,
} from "@/lib/regions";
import { AddressField } from "./AddressField";
import { CalendarBoard } from "./CalendarBoard";
import { EtaHint } from "./EtaHint";
import { CatalogBoard } from "./CatalogBoard";
import { HistoryBoard } from "./HistoryBoard";
import { LiveBoard } from "./LiveBoard";
import { PerformanceBoard } from "./PerformanceBoard";
import { CrewPick } from "./CrewPick";
import { ReplaceForm } from "./ReplaceForm";
import { RouteTimeline } from "./RouteTimeline";
import { Card, Field, GhostButton, Input, PrimaryButton, Select } from "./ui";

type Tab =
  | "vivo"
  | "rutas"
  | "asignar"
  | "armadas"
  | "calendario"
  | "desempeno"
  | "historial"
  | "catalogos";

export function JefaturaApp() {
  const {
    data,
    ready,
    addStop,
    addRestDay,
    removeRestDay,
    setStopLodgingPlan,
    setStopInstall,
    setStopTime,
    moveStop,
    removeStop,
    assign,
    removeAssignment,
    setStopAssignees,
    finishRoute,
    setRouteLead,
    setRouteVehicle,
    reset,
  } = useStore();
  const [tab, setTab] = useState<Tab>("vivo");

  const [date, setDate] = useState(() => nearestWorkday(isoDate()));
  const [day, setDay] = useState<Day>(
    () => dayFromIso(nearestWorkday(isoDate())) ?? "Lunes",
  );
  const [locationId, setLocationId] = useState("loc-metropolitana");
  const [workType, setWorkType] = useState<WorkType>("Instalación y capacitación");
  const [time, setTime] = useState("08:00");
  const [lodgingPlan, setLodgingPlan] = useState("");
  const [installAddress, setInstallAddress] = useState("");
  const [installKind, setInstallKind] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [eta, setEta] = useState<EtaResult | null>(null);
  const [pickedPlace, setPickedPlace] = useState<PlaceHit | null>(null);

  const [routeId, setRouteId] = useState(data.routes[0]?.id ?? "");
  const [techId, setTechId] = useState(data.technicians[0]?.id ?? "");
  const [swapId, setSwapId] = useState("");

  if (!ready) {
    return <p className="p-8 text-stone-600">Cargando despacho…</p>;
  }

  const actives = data.technicians.filter((t) => t.active);
  const regions = catalogRegions(data.locations);
  const regionId = regions.some((r) => r.id === locationId)
    ? locationId
    : (regions.find((r) => r.id === "loc-metropolitana")?.id ??
      regions[0]?.id ??
      "");
  const dayRoutes = sameDayOpenRoutes(data, date);
  const priorRoutes = continuableOpenRoutes(data, date);
  const preview = selectableOpenRoute(data, routeId, date);
  const appending = Boolean(preview);
  const returning = isReturnToBase(workType);
  const returnOrigin = lastWorkOrigin(data, preview);
  const resting = preview ? isRestDay(preview, date) : false;
  const canMarkRest = preview ? canRestOn(data, preview, date) : false;
  const vans = operativeVehicles(data);

  const selectedRoute =
    openRoutes(data).find((r) => r.id === routeId) ?? openRoutes(data)[0];
  const extras = selectedRoute
    ? freeTechniciansForRoute(data, selectedRoute.id)
    : [];
  const leadPool = selectedRoute
    ? leadCandidatesForRoute(data, selectedRoute.id)
    : [];
  const currentLead = selectedRoute
    ? actives.find((t) => t.id === selectedRoute.leadId)
    : undefined;
  const leads =
    currentLead && !leadPool.some((t) => t.id === currentLead.id)
      ? [currentLead, ...leadPool]
      : leadPool;
  const allOnRoute = Boolean(
    selectedRoute &&
      actives.length > 0 &&
      actives.every((t) =>
        data.assignments.some(
          (a) => a.routeId === selectedRoute.id && a.technicianId === t.id,
        ),
      ),
  );
  const extraId = extras.some((t) => t.id === techId)
    ? techId
    : extras[0]?.id ?? "";
  const chosenVan = vans.some((v) => v.id === selectedRoute?.vehicleId)
    ? selectedRoute?.vehicleId ?? ""
    : (vans[0]?.id ?? "");

  function applyPickedPlace(place: PlaceHit) {
    setPickedPlace(place);
    const nextRegion = regionIdOfPlace(place);
    if (nextRegion) setLocationId(nextRegion);
  }

  function onAddStop() {
    const next = addStop({
      day,
      date,
      locationId: returning ? BASE_LOCATION_ID : regionId,
      workType,
      time,
      routeId: appending ? routeId : undefined,
      lodgingPlan: needsLodging(workType) ? lodgingPlan : undefined,
      installAddress: hasSiteAddress(workType) ? installAddress : undefined,
      installKind: hasSiteAddress(workType) ? installKind : undefined,
      companyName: needsCompany(workType) ? companyName : undefined,
      leaveAt: timeIsDeparture(workType) ? time : eta?.leaveAt,
      etaAt: eta?.etaAt,
      travelMinutes: eta?.minutes,
      travelKm: eta?.km,
      destLat: eta?.destLat ?? pickedPlace?.lat,
      destLng: eta?.destLng ?? pickedPlace?.lng,
      city: pickedPlace ? localityOfPlace(pickedPlace) : undefined,
      place: pickedPlace ?? undefined,
    });
    setRouteId(next);
    setEta(null);
    setPickedPlace(null);
    if (needsLodging(workType)) setLodgingPlan("");
    if (needsCompany(workType)) setCompanyName("");
    if (hasSiteAddress(workType)) {
      setInstallAddress("");
      setInstallKind("");
    }
  }

  function leadLabel(id: string) {
    return id ? nameOf(data.technicians, id) : "Sin asignar";
  }

  function biasOf(id: string) {
    const loc = data.locations.find((l) => l.id === id);
    const coords = loc ? coordsOf(loc) : null;
    return coords
      ? { lat: coords[0], lng: coords[1] }
      : { lat: BASE_COORDS.lat, lng: BASE_COORDS.lng };
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gold">Jefatura</p>
          <h1 className="text-2xl font-bold text-navy">Despacho de servicio técnico</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-navy">
            Cambiar rol
          </Link>
          <GhostButton onClick={reset}>Restablecer demo</GhostButton>
        </div>
      </header>

      <nav className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {(
          [
            ["vivo", "En vivo"],
            ["rutas", "Armar"],
            ["asignar", "Cuadrilla"],
            ["armadas", "Rutas"],
            ["calendario", "Calendario"],
            ["desempeno", "Desempeño"],
            ["historial", "Historial"],
            ["catalogos", "Catálogos"],
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

      {tab === "vivo" ? <LiveBoard /> : null}
      {tab === "calendario" ? <CalendarBoard /> : null}
      {tab === "desempeno" ? <PerformanceBoard /> : null}
      {tab === "historial" ? <HistoryBoard /> : null}

      {tab === "rutas" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Nueva parada">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`Fecha (${day})`}>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    const next = nearestWorkday(e.target.value);
                    setDate(next);
                    setDay(dayFromIso(next) ?? "Lunes");
                    if (!selectableOpenRoute(data, routeId, next)) {
                      setRouteId(sameDayOpenRoutes(data, next)[0]?.id ?? "");
                    }
                  }}
                />
              </Field>
              <Field label="Ruta">
                <Select
                  value={appending ? routeId : "nueva"}
                  onChange={(e) =>
                    setRouteId(e.target.value === "nueva" ? "" : e.target.value)
                  }
                >
                  {dayRoutes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {leadLabel(r.leadId)} · este día
                    </option>
                  ))}
                  {priorRoutes.length > 0 ? (
                    <optgroup label="Continuar del día anterior">
                      {priorRoutes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.id} · {leadLabel(r.leadId)} · {formatRouteSpan(data, r)}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  <option value="nueva">Nueva ruta</option>
                </Select>
              </Field>
              {returning ? (
                <div className="sm:col-span-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                  Destino: INACAP Santiago Sur
                </div>
              ) : (
                <Field label="Región">
                  <Select
                    value={regionId}
                    onChange={(e) => setLocationId(e.target.value)}
                  >
                    {regions.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Tipo de trabajo">
                <Select
                  value={workType}
                  onChange={(e) => {
                    const next = e.target.value as WorkType;
                    setWorkType(next);
                    if (isReturnToBase(next)) {
                      setPickedPlace(null);
                    }
                  }}
                >
                  <optgroup label="Viaje">
                    {TRAVEL_TYPES.map((w) => (
                      <option key={w}>{w}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Trabajo">
                    {JOB_TYPES.map((w) => (
                      <option key={w}>{w}</option>
                    ))}
                  </optgroup>
                </Select>
              </Field>
              <Field label={timeFieldLabel(workType)}>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
              {needsLodging(workType) ? (
                <div className="sm:col-span-2">
                  <Field label="Lugar o dirección donde dormirán">
                    <AddressField
                      placeholder="Escribe hotel, recinto o calle…"
                      value={lodgingPlan}
                      bias={biasOf(regionId)}
                      onChange={(next) => {
                        setLodgingPlan(next);
                        setPickedPlace(null);
                      }}
                      onPick={(place) => {
                        setLodgingPlan(place.label);
                        applyPickedPlace(place);
                      }}
                    />
                  </Field>
                </div>
              ) : null}
              {needsCompany(workType) ? (
                <div className="sm:col-span-2">
                  <Field label="Empresa">
                    <Input
                      placeholder="Nombre de la empresa o recinto…"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </Field>
                </div>
              ) : null}
              {hasSiteAddress(workType) ? (
                <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                  <Field
                    label={
                      isDispatchWork(workType)
                        ? "Dirección de entrega"
                        : "Dirección de la instalación"
                    }
                  >
                    <AddressField
                      placeholder="Escribe calle, número o recinto…"
                      value={installAddress}
                      bias={biasOf(regionId)}
                      onChange={(next) => {
                        setInstallAddress(next);
                        setPickedPlace(null);
                      }}
                      onPick={(place) => {
                        setInstallAddress(place.label);
                        applyPickedPlace(place);
                      }}
                    />
                  </Field>
                  <Field
                    label={
                      isDispatchWork(workType)
                        ? "Producto o materiales"
                        : "Tipo de instalación"
                    }
                  >
                    <Input
                      placeholder={
                        isDispatchWork(workType)
                          ? "DVR, cámaras, cable, kit…"
                          : "Cámaras, alarma, red, DVR…"
                      }
                      value={installKind}
                      onChange={(e) => setInstallKind(e.target.value)}
                    />
                  </Field>
                </div>
              ) : null}
              {returning && !returnOrigin ? (
                <p className="sm:col-span-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-950">
                  Falta una locación de trabajo en esta ruta.
                </p>
              ) : (
                <EtaHint
                  origin={
                    returning
                      ? (returnOrigin ?? BASE_POINT)
                      : originForRoute(data, preview)
                  }
                  dest={
                    returning
                      ? BASE_POINT
                      : destForDraft(data, {
                          locationId: regionId,
                          lodgingPlan: needsLodging(workType)
                            ? lodgingPlan
                            : undefined,
                          installAddress: hasSiteAddress(workType)
                            ? installAddress
                            : undefined,
                          city: pickedPlace
                            ? localityOfPlace(pickedPlace)
                            : undefined,
                          lat: pickedPlace?.lat,
                          lng: pickedPlace?.lng,
                        })
                  }
                  clock={time}
                  mode={timeIsDeparture(workType) ? "depart" : "arrive"}
                  onChange={setEta}
                />
              )}
            </div>
            {resting ? (
              <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {preview?.id} tiene este día como descanso. Quítalo si quieres
                agregar paradas.
              </p>
            ) : (
              <PrimaryButton
                className="mt-4 w-full"
                onClick={onAddStop}
                disabled={
                  (returning && !returnOrigin) ||
                  (needsCompany(workType) && !companyName.trim()) ||
                  (needsLodging(workType) && !lodgingPlan.trim()) ||
                  (hasSiteAddress(workType) &&
                    (!installAddress.trim() || !installKind.trim()))
                }
              >
                {returning
                  ? appending
                    ? `Agregar regreso a ${preview?.id}`
                    : "Elige una ruta para el regreso"
                  : appending
                    ? `Agregar a ${preview?.id}`
                    : "Crear ruta y agregar parada"}
              </PrimaryButton>
            )}
            {preview && canMarkRest ? (
              <GhostButton
                type="button"
                className="mt-2 w-full"
                onClick={() =>
                  resting
                    ? removeRestDay(preview.id, date)
                    : addRestDay(preview.id, date)
                }
              >
                {resting
                  ? "Quitar descanso de este día"
                  : "Marcar este día como descanso"}
              </GhostButton>
            ) : null}
          </Card>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-navy">
              Vista previa
              {preview
                ? ` · ${preview.id}${resting ? " · descanso" : ""}`
                : ""}
            </p>
            {preview ? (
              <RouteTimeline data={data} route={preview} compact />
            ) : (
              <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
                No hay paradas para esta fecha.
              </p>
            )}
            {preview
              ? data.stops
                  .filter((s) => s.routeId === preview.id)
                  .sort((a, b) => a.order - b.order)
                  .map((s) => {
                    const dayKey = s.date ?? date;
                    const peers = data.stops
                      .filter(
                        (x) =>
                          x.routeId === preview.id &&
                          (x.date ?? date) === dayKey,
                      )
                      .sort((a, b) => a.order - b.order);
                    const index = peers.findIndex((x) => x.id === s.id);
                    const clockHint = stopClockHint(s);
                    return (
                    <div
                      key={s.id}
                      className="space-y-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-stone-200"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {s.order}. {formatDayPretty(s.date ?? date)} ·{" "}
                          {stopLocality(data, s)}
                          {companyNameOf(s) ? ` · ${companyNameOf(s)}` : ""} ·{" "}
                          {s.workType}
                          {clockHint ? ` · ${clockHint}` : ""}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="text-xs text-navy underline disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
                            disabled={index <= 0}
                            onClick={() => moveStop(s.id, -1)}
                          >
                            Subir
                          </button>
                          <button
                            type="button"
                            className="text-xs text-navy underline disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
                            disabled={index < 0 || index >= peers.length - 1}
                            onClick={() => moveStop(s.id, 1)}
                          >
                            Bajar
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-700 underline"
                            onClick={() => removeStop(s.id)}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                      <Field label={timeFieldLabel(s.workType)}>
                        <Input
                          type="time"
                          value={s.time}
                          onChange={(e) => setStopTime(s.id, e.target.value)}
                        />
                      </Field>
                      {needsLodging(s.workType) ? (
                        <div>
                          <AddressField
                            value={s.lodgingPlan ?? ""}
                            placeholder="Escribe hotel, recinto o calle…"
                            aria-label="Lugar de pernocte"
                            bias={biasOf(s.locationId)}
                            onChange={(next) => setStopLodgingPlan(s.id, next)}
                            onPick={(place) =>
                              setStopLodgingPlan(s.id, place.label, place)
                            }
                          />
                          <p className="mt-1 text-xs text-stone-500">
                            {lodgingPlace(s)
                              ? `${LODGING_LABEL[lodgingStatusOf(s)]}${
                                  s.lodgingStay && s.lodgingStay !== s.lodgingPlan
                                    ? ` · duermen en ${s.lodgingStay}`
                                    : ""
                                }`
                              : "Falta el lugar"}
                          </p>
                        </div>
                      ) : null}
                      {needsCompany(s.workType) ? (
                        <Input
                          value={s.companyName ?? ""}
                          placeholder="Nombre de la empresa o recinto…"
                          aria-label="Empresa"
                          onChange={(e) =>
                            setStopInstall(s.id, { company: e.target.value })
                          }
                        />
                      ) : null}
                      {hasSiteAddress(s.workType) ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <AddressField
                            value={s.installAddress ?? ""}
                            placeholder="Escribe calle, número o recinto…"
                            aria-label={
                              isDispatchWork(s.workType)
                                ? "Dirección de entrega"
                                : "Dirección de instalación"
                            }
                            bias={biasOf(s.locationId)}
                            onChange={(next) =>
                              setStopInstall(s.id, { address: next })
                            }
                            onPick={(place) =>
                              setStopInstall(s.id, {
                                address: place.label,
                                place,
                              })
                            }
                          />
                          <Input
                            defaultValue={s.installKind ?? ""}
                            placeholder={
                              isDispatchWork(s.workType)
                                ? "Producto o materiales"
                                : "Tipo de instalación"
                            }
                            aria-label={
                              isDispatchWork(s.workType)
                                ? "Producto o materiales"
                                : "Tipo de instalación"
                            }
                            onBlur={(e) =>
                              setStopInstall(s.id, { kind: e.target.value })
                            }
                          />
                          <p className="text-xs text-stone-500 sm:col-span-2">
                            {installKindOf(s) || installAddressOf(s)
                              ? `${installKindOf(s) || (isDispatchWork(s.workType) ? "Sin detalle" : "Sin tipo")} · ${
                                  installAddressOf(s) || "sin dirección"
                                } · ${LODGING_LABEL[installStatusOf(s)]}`
                              : isDispatchWork(s.workType)
                                ? "Falta dirección y qué se deja"
                                : "Falta dirección y tipo"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    );
                  })
              : null}
          </div>
        </div>
      ) : null}

      {tab === "asignar" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
          <Card title="Armar la cuadrilla">
            <div className="grid gap-3">
              <Field label="Ruta">
                <Select value={selectedRoute?.id ?? ""} onChange={(e) => setRouteId(e.target.value)}>
                  {openRoutes(data).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {formatRouteSpan(data, r)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Encargado">
                <Select
                  value={selectedRoute?.leadId ?? ""}
                  onChange={(e) => {
                    if (!selectedRoute) return;
                    setRouteLead(selectedRoute.id, e.target.value);
                  }}
                  disabled={!selectedRoute}
                >
                  <option value="">Sin asignar</option>
                  {leads.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Vehículo">
                {!selectedRoute ? (
                  <p className="text-sm text-stone-500">Elige una ruta.</p>
                ) : vans.length === 0 ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    No hay vehículos operativos. Márcalos en Catálogos.
                  </p>
                ) : (
                  <Select
                    value={
                      selectedRoute.vehicleId &&
                      vans.some((v) => v.id === selectedRoute.vehicleId)
                        ? selectedRoute.vehicleId
                        : ""
                    }
                    onChange={(e) => {
                      if (e.target.value) {
                        setRouteVehicle(selectedRoute.id, e.target.value);
                      }
                    }}
                  >
                    <option value="">Sin asignar</option>
                    {vans.map((v) => (
                      <option key={v.id} value={v.id}>
                        {vehicleLabel(v)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Card>
          <Card title="Técnico extra">
            <Field label="Técnico">
              <Select
                value={extraId}
                onChange={(e) => setTechId(e.target.value)}
                disabled={extras.length === 0}
              >
                {extras.length === 0 ? (
                  <option value="">
                    {allOnRoute
                      ? "Todos ya van en esta ruta"
                      : "No hay técnicos libres cerca"}
                  </option>
                ) : (
                  extras.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </Select>
            </Field>
            <PrimaryButton
              className="mt-3 w-full"
              disabled={!selectedRoute || !extraId}
              onClick={() => {
                if (!selectedRoute || !extraId) return;
                assign({
                  routeId: selectedRoute.id,
                  technicianId: extraId,
                  vehicleId: selectedRoute.vehicleId || chosenVan,
                  mode: "Grupal",
                  peopleInVan: 0,
                  peopleOnRoute: 0,
                  perDiem: 10000,
                });
                const next = extras.find((t) => t.id !== extraId);
                setTechId(next?.id ?? "");
              }}
            >
              Sumar técnico a la ruta
            </PrimaryButton>
          </Card>
          </div>

          <div className="space-y-3">
            {selectedRoute ? <RouteTimeline data={data} route={selectedRoute} /> : null}
            {selectedRoute
              ? data.assignments
                  .filter((a) => a.routeId === selectedRoute.id)
                  .slice()
                  .sort((a, b) => {
                    if (a.technicianId === selectedRoute.leadId) return -1;
                    if (b.technicianId === selectedRoute.leadId) return 1;
                    return 0;
                  })
                  .map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-stone-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {nameOf(data.technicians, a.technicianId)}
                          {a.technicianId === selectedRoute.leadId
                            ? ` · lleva ${money(routePayout(data, selectedRoute.id))}`
                            : ""}
                          <span className="mt-0.5 block text-xs font-medium text-stone-500">
                            {a.seenAt
                              ? `Visto ${formatWhen(a.seenAt)}`
                              : hasAckedRoute(
                                    data,
                                    selectedRoute.id,
                                    a.technicianId,
                                  )
                                ? "Visto"
                                : "Sin acuse"}
                          </span>
                        </span>
                        <div className="flex gap-3">
                          <button
                            className="text-navy underline"
                            onClick={() =>
                              setSwapId(swapId === a.id ? "" : a.id)
                            }
                          >
                            Reemplazar
                          </button>
                          {a.technicianId === selectedRoute.leadId ? (
                            <span className="text-xs text-stone-400">Ya va</span>
                          ) : (
                            <button className="text-red-700 underline" onClick={() => removeAssignment(a.id)}>
                              Quitar
                            </button>
                          )}
                        </div>
                      </div>
                      {swapId === a.id ? (
                        <ReplaceForm
                          routeId={selectedRoute.id}
                          fromId={a.technicianId}
                          onDone={() => setSwapId("")}
                        />
                      ) : null}
                    </div>
                  ))
              : null}
            {selectedRoute ? (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-semibold text-navy">Quién hace cada trabajo</p>
                {data.stops
                  .filter(
                    (s) =>
                      s.routeId === selectedRoute.id &&
                      !isLocationPing(s.workType),
                  )
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-stone-200"
                    >
                      <span>
                        {stopLocality(data, s)} · {s.workType}
                      </span>
                      <CrewPick
                        ids={crewIds(data, selectedRoute.id, selectedRoute.leadId)}
                        selected={
                          s.assigneeIds?.length
                            ? s.assigneeIds
                            : s.assigneeId
                              ? [s.assigneeId]
                              : selectedRoute.leadId
                                ? [selectedRoute.leadId]
                                : []
                        }
                        leadId={selectedRoute.leadId}
                        onChange={(next) => setStopAssignees(s.id, next)}
                      />
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "catalogos" ? <CatalogBoard /> : null}

      {tab === "armadas" ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-navy">Rutas</h2>
          </div>
          {openRoutes(data).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
              No hay rutas abiertas.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {openRoutes(data).map((r) => (
                <div key={r.id} className="space-y-2">
                  <RouteTimeline data={data} route={r} />
                  <PrimaryButton
                    type="button"
                    className="w-full text-sm"
                    onClick={() => {
                      finishRoute(r.id);
                      if (routeId === r.id) {
                        const left = openRoutes(data).filter((x) => x.id !== r.id);
                        setRouteId(left[0]?.id ?? "");
                      }
                    }}
                  >
                    Finalizar {r.id}
                  </PrimaryButton>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
