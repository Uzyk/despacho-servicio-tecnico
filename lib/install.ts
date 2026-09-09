import type { LodgingStatus, Stop, WorkType } from "./types";

export function isInstallWork(workType: WorkType) {
  return workType === "Instalación" || workType === "Instalación y capacitación";
}

export function isDispatchWork(workType: WorkType) {
  return workType === "Despacho";
}

export function hasSiteAddress(workType: WorkType) {
  return isInstallWork(workType) || isDispatchWork(workType);
}

export function needsCompany(workType: WorkType) {
  return (
    isInstallWork(workType) ||
    isDispatchWork(workType) ||
    workType === "Capacitación"
  );
}

export function isReturnToBase(workType: WorkType) {
  return workType === "Regreso a base";
}

export function timeIsDeparture(workType: WorkType) {
  return workType === "Traslado y pernocte";
}

export function timeFieldLabel(workType: WorkType) {
  if (isReturnToBase(workType)) return "Hora de llegada a INACAP";
  if (workType === "Despacho") return "Hora de entrega";
  if (timeIsDeparture(workType)) return "Hora de salida";
  if (workType === "Traslado" || workType === "Pernocte") {
    return "Hora de llegada";
  }
  return "Hora en locación";
}

export function installAddressOf(stop: Stop) {
  return (stop.installAddressStay || stop.installAddress || "").trim();
}

export function installKindOf(stop: Stop) {
  return (stop.installKind || "").trim();
}

export function installStatusOf(stop: Stop): LodgingStatus {
  return stop.installStatus ?? "pendiente";
}

export function companyNameOf(stop: Stop) {
  return (stop.companyName || "").trim();
}

export function installDetail(stop: Stop) {
  return [installKindOf(stop), installAddressOf(stop)]
    .filter(Boolean)
    .join(" · ");
}

export function installSummary(stop: Stop) {
  return [companyNameOf(stop), installDetail(stop)].filter(Boolean).join(" · ");
}
