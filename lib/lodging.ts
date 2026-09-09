import type { LodgingStatus, Stop, WorkType } from "./types";

export const LODGING_LABEL: Record<LodgingStatus, string> = {
  pendiente: "Por confirmar",
  confirmado: "Confirmado por el encargado",
  cambiado: "Cambiado por el encargado",
};

export function lodgingPlace(stop: Stop) {
  return (stop.lodgingStay || stop.lodgingPlan || "").trim();
}

export function lodgingStatusOf(stop: Stop): LodgingStatus {
  return stop.lodgingStatus ?? "pendiente";
}

export function needsLodging(workType: WorkType) {
  return workType === "Pernocte" || workType === "Traslado y pernocte";
}
