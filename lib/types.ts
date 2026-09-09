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
  | "Despacho"
  | "Traslado"
  | "Pernocte"
  | "Traslado y pernocte"
  | "Regreso a base";

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
  lat?: number;
  lng?: number;
};

export type VehicleKind = "Camioneta" | "Furgón" | "Auto" | "Otro";

export type VehicleStatus = "operativo" | "fuera_de_servicio";

export type Vehicle = {
  id: string;
  name: string;
  model?: string;
  kind?: VehicleKind;
  plate: string;
  status?: VehicleStatus;
};

export type RouteStatus = "abierta" | "finalizada";

export type Route = {
  id: string;
  day: Day;
  date?: string;
  leadId: string;
  vehicleId?: string;
  status?: RouteStatus;
  closedAt?: number;
  restDates?: string[];
};

export type LodgingStatus = "pendiente" | "confirmado" | "cambiado";

export type Stop = {
  id: string;
  routeId: string;
  order: number;
  locationId: string;
  city?: string;
  workType: WorkType;
  time: string;
  date?: string;
  assigneeId?: string;
  assigneeIds?: string[];
  lodgingPlan?: string;
  lodgingStay?: string;
  lodgingStatus?: LodgingStatus;
  installAddress?: string;
  installAddressStay?: string;
  installStatus?: LodgingStatus;
  installKind?: string;
  companyName?: string;
  etaAt?: string;
  leaveAt?: string;
  travelMinutes?: number;
  travelKm?: number;
  destLat?: number;
  destLng?: number;
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
  seenAt?: number;
};

export type TaskItem = {
  id: string;
  label: string;
  done: boolean;
};

export type StopProgress = {
  id: string;
  stopId: string;
  technicianId: string;
  arrivedAt: string;
  leftAt: string;
  arrivedAtMs?: number;
  leftAtMs?: number;
  arrivedLat?: number;
  arrivedLng?: number;
  arrivedAccuracyM?: number;
  leftLat?: number;
  leftLng?: number;
  leftAccuracyM?: number;
  closeNote?: string;
  closePhoto?: string;
  tasks: TaskItem[];
};

export type LogKind =
  | "asignado"
  | "baja"
  | "entra"
  | "visto"
  | "llegada"
  | "salida"
  | "ruta_cerrada";

export type LogEvent = {
  id: string;
  at: number;
  technicianId: string;
  routeId?: string;
  stopId?: string;
  kind: LogKind;
  note: string;
  relatedTechnicianId?: string;
};

export type AppData = {
  technicians: Technician[];
  locations: Location[];
  vehicles: Vehicle[];
  routes: Route[];
  stops: Stop[];
  assignments: Assignment[];
  progress: StopProgress[];
  events: LogEvent[];
  updatedAt?: number;
};

export const FAIL_REASONS = [
  "No se presentó",
  "Enfermedad",
  "Problema personal",
  "Problema de vehículo",
  "Otro",
] as const;

export const DAYS: Day[] = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
];

export const VEHICLE_KINDS: VehicleKind[] = [
  "Camioneta",
  "Furgón",
  "Auto",
  "Otro",
];

export const TRAVEL_TYPES: WorkType[] = [
  "Traslado y pernocte",
  "Regreso a base",
];

export const JOB_TYPES: WorkType[] = [
  "Instalación",
  "Capacitación",
  "Instalación y capacitación",
  "Despacho",
];

export const WORK_TYPES: WorkType[] = [...TRAVEL_TYPES, ...JOB_TYPES];
