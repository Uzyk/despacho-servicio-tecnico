import type { AppData, Vehicle, VehicleKind, VehicleStatus } from "./types";

export function isVehicleOperative(vehicle: Vehicle) {
  return (vehicle.status ?? "operativo") === "operativo";
}

export function operativeVehicles(data: AppData) {
  return data.vehicles.filter(isVehicleOperative);
}

export function firstOperativeVehicleId(data: AppData, exceptId?: string) {
  return (
    data.vehicles.find(
      (v) => isVehicleOperative(v) && v.id !== exceptId,
    )?.id ?? ""
  );
}

export function pickOperativeVehicleId(data: AppData, vehicleId?: string) {
  if (
    vehicleId &&
    data.vehicles.some((v) => v.id === vehicleId && isVehicleOperative(v))
  ) {
    return vehicleId;
  }
  return firstOperativeVehicleId(data);
}

export function vehicleModel(vehicle: Vehicle) {
  return vehicle.model || vehicle.name;
}

export function vehicleKindOf(vehicle: Vehicle): VehicleKind {
  return vehicle.kind ?? "Camioneta";
}

export function vehicleStatusOf(vehicle: Vehicle): VehicleStatus {
  return vehicle.status ?? "operativo";
}

export function vehicleLabel(vehicle: Vehicle) {
  const parts = [vehicleModel(vehicle)];
  if (vehicle.kind) parts.push(vehicle.kind);
  if (vehicle.plate) parts.push(vehicle.plate);
  return parts.join(" · ");
}

export function vehicleNameOf(data: AppData, id: string) {
  const found = data.vehicles.find((v) => v.id === id);
  return found ? vehicleLabel(found) : id;
}
