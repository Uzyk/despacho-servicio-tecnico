export type Day =
  | "Lunes"
  | "Martes"
  | "Miércoles"
  | "Jueves"
  | "Viernes";

export type WorkType =
  | "Instalación"
  | "Capacitación"
  | "Instalación y capacitación"
  | "Traslado";

export type Mode = "Individual" | "Grupal";

export type Technician = {
  id: string;
  name: string;
  active: boolean;
};

export type Location = {
  id: string;
  name: string;
  zone: string;
  workType: WorkType;
  equipment: number;
};

export type Vehicle = {
  id: string;
  name: string;
  plate: string;
};

export type Route = {
  id: string;
  day: Day;
  leadId: string;
};

export type Stop = {
  id: string;
  routeId: string;
  order: number;
  locationId: string;
  workType: WorkType;
  time: string;
};

export type Assignment = {
  id: string;
  routeId: string;
  technicianId: string;
  vehicleId: string;
  mode: Mode;
  peopleInVan: number;
  peopleOnRoute: number;
  perDiem: number;
};

export type AppData = {
  technicians: Technician[];
  locations: Location[];
  vehicles: Vehicle[];
  routes: Route[];
  stops: Stop[];
  assignments: Assignment[];
};

export const DAYS: Day[] = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
];

export const WORK_TYPES: WorkType[] = [
  "Instalación",
  "Capacitación",
  "Instalación y capacitación",
  "Traslado",
];
