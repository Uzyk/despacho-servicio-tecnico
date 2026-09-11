import { hasSiteAddress, needsCompany } from "./install";
import { cleanMaterials } from "./kit";
import { isRouteOpen } from "./record";
import type { AppData, KitItem, WorkOrder, WorkOrderStatus, WorkType } from "./types";
import { JOB_TYPES } from "./types";

export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  pendiente: "Pendiente",
  en_ruta: "En ruta",
  cerrada: "Cerrada",
  no_realizada: "No realizada",
};

export function nextWorkOrderId(data: AppData) {
  const nums = (data.workOrders ?? []).map((order) => {
    const m = order.id.match(/OT-(\d+)/);
    return m ? Number(m[1]) : 0;
  });
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `OT-${String(next).padStart(3, "0")}`;
}

export function workOrderOf(data: AppData, id?: string) {
  if (!id) return undefined;
  return (data.workOrders ?? []).find((order) => order.id === id);
}

export function pendingWorkOrders(data: AppData) {
  return (data.workOrders ?? []).filter((order) => order.status === "pendiente");
}

export function isJobType(workType: WorkType) {
  return JOB_TYPES.includes(workType);
}

export function workOrderLabel(order: WorkOrder) {
  return `${order.id} · ${order.companyName} · ${order.workType}`;
}

export function companyContactLabel(order: {
  contactName?: string;
  contactPhone?: string;
}) {
  return [order.contactName?.trim(), order.contactPhone?.trim()]
    .filter(Boolean)
    .join(" · ");
}

export function telHref(phone: string) {
  const compact = phone.replace(/\s+/g, "");
  return compact ? `tel:${compact}` : "";
}

export function workOrderReady(order: {
  workType: WorkType;
  companyName: string;
  contactName?: string;
  contactPhone?: string;
  locationId: string;
  address: string;
  installKind: string;
  materials?: KitItem[];
}) {
  if (!isJobType(order.workType) || !order.locationId) return false;
  if (needsCompany(order.workType) && !order.companyName.trim()) return false;
  if (
    needsCompany(order.workType) &&
    (!order.contactName?.trim() || !order.contactPhone?.trim())
  ) {
    return false;
  }
  if (
    hasSiteAddress(order.workType) &&
    (!order.address.trim() || !order.installKind.trim())
  ) {
    return false;
  }
  if (cleanMaterials(order.materials).length === 0) return false;
  return true;
}

export function syncWorkOrders(data: AppData): WorkOrder[] {
  return (data.workOrders ?? []).map((order) => {
    const stop = data.stops.find((s) => s.workOrderId === order.id);
    if (!stop) {
      if (order.status === "cerrada") return order;
      return {
        ...order,
        status: "pendiente" as const,
        stopId: undefined,
        routeId: undefined,
      };
    }
    const missed = (data.progress ?? []).some(
      (p) => p.stopId === stop.id && p.outcome === "no_realizado",
    );
    const route = data.routes.find((r) => r.id === stop.routeId);
    const closed = route ? !isRouteOpen(route) : false;
    const status: WorkOrderStatus = missed
      ? "no_realizada"
      : closed
        ? "cerrada"
        : "en_ruta";
    return {
      ...order,
      status,
      stopId: stop.id,
      routeId: stop.routeId,
    };
  });
}
