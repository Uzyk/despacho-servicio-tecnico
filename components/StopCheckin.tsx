"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  clockNow,
  formatHours,
  isLocationPing,
  isStopAssignedTo,
  isStopDone,
  priorStop,
  progressOf,
  stayMinutes,
} from "@/lib/hours";
import {
  companyNameOf,
  hasSiteAddress,
  installAddressOf,
  installKindOf,
  installStatusOf,
  isDispatchWork,
  isReturnToBase,
} from "@/lib/install";
import { lodgingPlace, lodgingStatusOf, LODGING_LABEL, needsLodging } from "@/lib/lodging";
import { formatDayPretty } from "@/lib/calendar";
import { BASE_ADDRESS, BASE_COORDS, coordsOf, formatGps, requestFix } from "@/lib/geo";
import { stopClockHint } from "@/lib/eta";
import { compressPhoto } from "@/lib/evidence";
import { useStore } from "@/lib/store";
import { stopLocality } from "@/lib/regions";
import type { Stop } from "@/lib/types";
import type { PlaceHit } from "@/lib/places";
import { AddressField } from "./AddressField";
import { AddressWithMaps } from "./MapsLink";
import { CloseEvidence } from "./CloseEvidence";
import { Field, GhostButton, PrimaryButton, Textarea } from "./ui";

function useLiveClock() {
  const [now, setNow] = useState(() => clockNow());
  useEffect(() => {
    const tick = () => setNow(clockNow());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function StopCheckin({
  stop,
  technicianId,
  closed,
}: {
  stop: Stop;
  technicianId: string;
  closed?: boolean;
}) {
  const {
    data,
    markArrival,
    markDeparture,
    toggleTask,
    openChecklist,
    confirmLodging,
    changeLodging,
    confirmInstall,
    changeInstall,
  } = useStore();
  const [otherPlace, setOtherPlace] = useState("");
  const [otherAddress, setOtherAddress] = useState("");
  const [lodgingHit, setLodgingHit] = useState<PlaceHit | null>(null);
  const [installHit, setInstallHit] = useState<PlaceHit | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const [closePhoto, setClosePhoto] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const [locating, setLocating] = useState<"arrive" | "leave" | null>(null);
  const now = useLiveClock();
  const locationOnly = isLocationPing(stop.workType);

  const assigned = !closed && isStopAssignedTo(stop, technicianId);

  useEffect(() => {
    if (!locationOnly && assigned) openChecklist(stop.id, technicianId);
  }, [assigned, locationOnly, openChecklist, stop.id, technicianId]);

  const loc = stopLocality(data, stop);
  const locRow = data.locations.find((l) => l.id === stop.locationId);
  const locCoords =
    stop.destLat != null && stop.destLng != null
      ? ([stop.destLat, stop.destLng] as [number, number])
      : locRow
        ? coordsOf(locRow)
        : null;
  const addressBias = locCoords
    ? { lat: locCoords[0], lng: locCoords[1] }
    : BASE_COORDS;
  const route = data.routes.find((r) => r.id === stop.routeId);
  const isLead = Boolean(route?.leadId && route.leadId === technicianId);
  const place = lodgingPlace(stop);
  const lodgingStatus = lodgingStatusOf(stop);
  const p = progressOf(data.progress, stop.id, technicianId);
  const mins = stayMinutes(p);
  const tasks = p?.tasks ?? [];
  const previous = priorStop(data.stops, stop, technicianId);
  const prevProgress = previous
    ? progressOf(data.progress, previous.id, technicianId)
    : undefined;
  const prevOpen = Boolean(previous && !isStopDone(previous, prevProgress));
  const canArrive = assigned && !p?.arrivedAt && !prevOpen && locating !== "leave";
  const canLeave = Boolean(
    assigned &&
      !locationOnly &&
      p?.arrivedAt &&
      !p.leftAt &&
      locating !== "arrive" &&
      closeNote.trim() &&
      !photoBusy,
  );
  const clockHint = stopClockHint(stop);

  async function stampArrive() {
    if (!canArrive || locating) return;
    setLocating("arrive");
    const fix = await requestFix();
    markArrival(stop.id, technicianId, fix);
    setLocating(null);
  }

  async function stampLeave() {
    if (!canLeave || locating) return;
    setLocating("leave");
    const fix = await requestFix();
    markDeparture(stop.id, technicianId, fix, {
      note: closeNote.trim(),
      photo: closePhoto || undefined,
    });
    setLocating(null);
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoErr("");
    try {
      setClosePhoto(await compressPhoto(file));
    } catch {
      setPhotoErr("No pude leer esa foto. Prueba JPG o PNG.");
    }
    setPhotoBusy(false);
  }

  const badge = locationOnly
    ? p?.arrivedAt
      ? needsLodging(stop.workType)
        ? "Pernocta aquí"
        : "Llegó bien"
      : "Pendiente"
    : p?.leftAt
      ? "Cerrada"
      : p?.arrivedAt
        ? "Trabajando"
        : "Pendiente";

  const badgeClass = locationOnly
    ? p?.arrivedAt
      ? "bg-sky-50 text-sky-900"
      : "bg-stone-100 text-stone-600"
    : p?.leftAt
      ? "bg-emerald-50 text-emerald-800"
      : p?.arrivedAt
        ? "bg-amber-50 text-amber-900"
        : "bg-stone-100 text-stone-600";

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">
            Parada {stop.order}
            {stop.date ? ` · ${formatDayPretty(stop.date)}` : ""}
          </p>
          <h3 className="text-lg font-bold text-navy">
            {companyNameOf(stop) || loc}
          </h3>
          <p className="text-sm text-stone-600">
            {companyNameOf(stop) ? `${loc} · ${stop.workType}` : stop.workType}
          </p>
          {clockHint ? (
            <p className="mt-1 text-sm font-medium text-sky-800">
              {clockHint}
            </p>
          ) : null}
          {isReturnToBase(stop.workType) ? (
            <p className="mt-1 flex items-start gap-2 text-sm">
              <span className="shrink-0 font-medium text-stone-500">Lugar:</span>
              <AddressWithMaps
                text={BASE_ADDRESS}
                coords={BASE_COORDS}
                className="font-medium text-navy"
              />
            </p>
          ) : null}
          {needsLodging(stop.workType) && place ? (
            <p className="mt-1 flex items-start gap-2 text-sm">
              <span className="shrink-0 font-medium text-stone-500">Lugar:</span>
              <AddressWithMaps
                text={place}
                coords={locCoords}
                className="font-medium text-navy"
              />
            </p>
          ) : null}
          {hasSiteAddress(stop.workType) ? (
            <div className="mt-1 space-y-1">
              {installKindOf(stop) ? (
                <p className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 font-medium text-stone-500">Tipo:</span>
                  <span className="font-medium text-navy">
                    {installKindOf(stop)}
                  </span>
                </p>
              ) : null}
              {installAddressOf(stop) ? (
                <p className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 font-medium text-stone-500">Lugar:</span>
                  <AddressWithMaps
                    text={installAddressOf(stop)}
                    coords={locCoords}
                    className="font-medium text-navy"
                  />
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
          {badge}
        </span>
      </div>

      {needsLodging(stop.workType) ? (
        <div className="mb-3 rounded-2xl bg-amber-50 px-3 py-3 text-sm">
          <p className="font-semibold text-amber-950">
            Hospedaje · {LODGING_LABEL[lodgingStatus]}
          </p>
          {!closed && isLead && lodgingStatus === "pendiente" ? (
            <div className="mt-3 space-y-2">
              <PrimaryButton
                type="button"
                className="w-full text-sm"
                disabled={!stop.lodgingPlan}
                onClick={() => confirmLodging(stop.id, technicianId)}
              >
                Confirmar este lugar
              </PrimaryButton>
              <Field label="Otro lugar">
                <AddressField
                  value={otherPlace}
                  placeholder="Escribe hotel, recinto o calle…"
                  bias={addressBias}
                  onChange={(value) => {
                    setOtherPlace(value);
                    setLodgingHit(null);
                  }}
                  onPick={(place) => {
                    setOtherPlace(place.label);
                    setLodgingHit(place);
                  }}
                />
              </Field>
              <GhostButton
                type="button"
                className="w-full"
                disabled={!otherPlace.trim()}
                onClick={() => {
                  changeLodging(stop.id, technicianId, otherPlace, lodgingHit ?? undefined);
                  setOtherPlace("");
                  setLodgingHit(null);
                }}
              >
                Cambiar hospedaje
              </GhostButton>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasSiteAddress(stop.workType) ? (
        <div className="mb-3 rounded-2xl bg-sky-50 px-3 py-3 text-sm">
          <p className="font-semibold text-sky-950">
            {isDispatchWork(stop.workType) ? "Despacho" : "Instalación"} ·{" "}
            {LODGING_LABEL[installStatusOf(stop)]}
          </p>
          {!closed && isLead && installStatusOf(stop) === "pendiente" ? (
            <div className="mt-3 space-y-2">
              <PrimaryButton
                type="button"
                className="w-full text-sm"
                disabled={!stop.installAddress}
                onClick={() => confirmInstall(stop.id, technicianId)}
              >
                Confirmar esta dirección
              </PrimaryButton>
              <Field label="Otra dirección">
                <AddressField
                  value={otherAddress}
                  placeholder="Escribe calle, número o recinto…"
                  bias={addressBias}
                  onChange={(value) => {
                    setOtherAddress(value);
                    setInstallHit(null);
                  }}
                  onPick={(place) => {
                    setOtherAddress(place.label);
                    setInstallHit(place);
                  }}
                />
              </Field>
              <GhostButton
                type="button"
                className="w-full"
                disabled={!otherAddress.trim()}
                onClick={() => {
                  changeInstall(stop.id, technicianId, otherAddress, installHit ?? undefined);
                  setOtherAddress("");
                  setInstallHit(null);
                }}
              >
                Cambiar dirección
              </GhostButton>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={`grid gap-3 ${
          locationOnly || (p?.arrivedAt && !p.leftAt && !closed) ? "" : "sm:grid-cols-2"
        }`}
      >
        <StampBox
          label="Llegada"
          recorded={p?.arrivedAt}
          live={now}
          action={
            closed ? null : (
            <PrimaryButton
              type="button"
              disabled={!canArrive || locating === "arrive"}
              onClick={() => void stampArrive()}
            >
              {locating === "arrive" ? "Buscando GPS…" : "Llegué"}
            </PrimaryButton>
            )
          }
          hint={
            closed
              ? p?.arrivedAt
                ? gpsStampHint(p, "arrive", "Ruta finalizada")
                : "Ruta finalizada"
              : p?.arrivedAt
              ? gpsStampHint(p, "arrive", "Ubicación registrada")
              : prevOpen && previous
                ? isLocationPing(previous.workType)
                  ? `Primero marca Llegué en ${stopLocality(data, previous)}`
                  : `Primero cierra el trabajo en ${stopLocality(data, previous)}`
                : locating === "arrive"
                  ? "El teléfono pedirá permiso de ubicación"
                  : undefined
          }
        />
        {locationOnly || (p?.arrivedAt && !p.leftAt && !closed) ? null : (
          <StampBox
            label="Salida"
            recorded={p?.leftAt}
            live={now}
            action={null}
            hint={
              p?.leftAt
                ? gpsStampHint(p, "leave", "Hora registrada")
                : undefined
            }
          />
        )}
      </div>

      {locationOnly ? null : (
        <>
          <p className="mt-3 text-sm font-medium text-stone-700">
            Permanencia:{" "}
            {mins > 0
              ? formatHours(mins)
              : closed
                ? "sin horas"
                : "pendiente"}
          </p>
          <fieldset className="mt-4 space-y-2" disabled={closed}>
            <legend className="text-sm font-semibold text-navy">Tareas</legend>
            {tasks.length === 0 ? (
              <p className="text-sm text-stone-500">Cargando checklist…</p>
            ) : (
              tasks.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl bg-stone-50 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleTask(stop.id, technicianId, t.id)}
                    className="h-5 w-5 accent-navy"
                  />
                  <span className={t.done ? "text-stone-500 line-through" : ""}>
                    {t.label}
                  </span>
                </label>
              ))
            )}
          </fieldset>
          {p?.leftAt ? (
            <CloseEvidence note={p.closeNote} photo={p.closePhoto} />
          ) : p?.arrivedAt && !closed ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-stone-200 p-3">
              <p className="text-sm font-semibold text-navy">Cierre del trabajo</p>
              <Field label="Nota de cierre">
                <Textarea
                  rows={3}
                  value={closeNote}
                  placeholder="Qué se hizo, si quedó algo pendiente, si el cliente estaba…"
                  onChange={(e) => setCloseNote(e.target.value)}
                />
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-navy">
                  Foto (opcional)
                </p>
                {closePhoto ? (
                  <img
                    src={closePhoto}
                    alt="Vista previa de la foto de cierre"
                    className="mb-2 max-h-40 w-full rounded-xl object-cover"
                  />
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-stone-50">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      disabled={photoBusy}
                      onChange={(e) => {
                        void onPickPhoto(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {photoBusy
                      ? "Comprimiendo…"
                      : closePhoto
                        ? "Cambiar foto"
                        : "Tomar o adjuntar foto"}
                  </label>
                  {closePhoto ? (
                    <GhostButton type="button" onClick={() => setClosePhoto("")}>
                      Quitar foto
                    </GhostButton>
                  ) : null}
                </div>
                {photoErr ? (
                  <p className="mt-1 text-xs text-red-700">{photoErr}</p>
                ) : null}
              </div>
              <StampBox
                label="Salida"
                recorded={p?.leftAt}
                live={now}
                action={
                  <GhostButton
                    type="button"
                    disabled={!canLeave || locating === "leave"}
                    onClick={() => void stampLeave()}
                  >
                    {locating === "leave" ? "Buscando GPS…" : "Me fui"}
                  </GhostButton>
                }
                hint={
                  !closeNote.trim()
                    ? "Escribe la nota de cierre"
                    : locating === "leave"
                      ? "El teléfono pedirá permiso de ubicación"
                      : undefined
                }
              />
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

function gpsStampHint(
  p: { arrivedLat?: number; arrivedLng?: number; arrivedAccuracyM?: number; leftLat?: number; leftLng?: number; leftAccuracyM?: number } | undefined,
  when: "arrive" | "leave",
  fallback: string,
) {
  const lat = when === "leave" ? p?.leftLat : p?.arrivedLat;
  const lng = when === "leave" ? p?.leftLng : p?.arrivedLng;
  const acc = when === "leave" ? p?.leftAccuracyM : p?.arrivedAccuracyM;
  const gps = formatGps(lat, lng);
  if (!gps) return `${fallback} · sin GPS del teléfono`;
  const plus =
    acc != null && Number.isFinite(acc) ? ` ±${Math.round(acc)} m` : "";
  return `${fallback} · GPS ${gps}${plus}`;
}

function StampBox({
  label,
  recorded,
  live,
  action,
  hint,
}: {
  label: string;
  recorded?: string;
  live: string;
  action?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-stone-50 p-3">
      <p className="mb-1 text-sm font-semibold text-navy">{label}</p>
      <p
        className={`font-mono text-3xl font-bold ${
          recorded ? "text-navy" : "text-stone-400"
        }`}
      >
        {recorded || (action ? live : "—")}
      </p>
      {action ? <div className="mt-3">{action}</div> : null}
      {hint ? <p className="mt-2 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}
