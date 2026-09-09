import { hasSiteAddress, needsCompany } from "./install";
import { isRouteOpen } from "./record";
import type { AppData, WorkOrder, WorkOrderStatus, WorkType } from "./types";
import { JOB_TYPES } from "./types";

export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  pendiente: "Pendiente",
  en_ruta: "En ruta",
  cerrada: "Cerrada",
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

export function workOrderReady(order: {
  workType: WorkType;
  companyName: string;
  locationId: string;
  address: string;
  installKind: string;
}) {
  if (!isJobType(order.workType) || !order.locationId) return false;
  if (needsCompany(order.workType) && !order.companyName.trim()) return false;
  if (
    hasSiteAddress(order.workType) &&
    (!order.address.trim() || !order.installKind.trim())
  ) {
    return false;
  }
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
    const route = data.routes.find((r) => r.id === stop.routeId);
    const closed = route ? !isRouteOpen(route) : false;
    return {
      ...order,
      status: closed ? ("cerrada" as const) : ("en_ruta" as const),
      stopId: stop.id,
      routeId: stop.routeId,
    };
  });
}
