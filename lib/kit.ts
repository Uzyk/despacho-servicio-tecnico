import type { AppData, KitItem, Stop, StopProgress, TaskItem, WorkOrder } from "./types";

export function cleanMaterials(items?: KitItem[] | null): KitItem[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const next: KitItem[] = [];
  for (const item of items) {
    const label = (item?.label ?? "").trim();
    if (!label) continue;
    const id = (item?.id ?? "").trim() || `m-${next.length + 1}`;
    if (seen.has(id)) continue;
    seen.add(id);
    next.push({ id, label });
  }
  return next;
}

export function materialsOf(order?: WorkOrder | null) {
  const listed = cleanMaterials(order?.materials);
  if (listed.length) return listed;
  const fallback = (order?.installKind ?? "").trim();
  if (!fallback || !order) return [];
  return [{ id: `m-${order.id}`, label: fallback }];
}

export function kitLine(order?: WorkOrder | null) {
  return materialsOf(order)
    .map((item) => item.label)
    .join(" · ");
}

export function kitFromMaterials(materials: KitItem[]): TaskItem[] {
  return materials.map((item) => ({
    id: item.id,
    label: item.label,
    done: false,
  }));
}

export function kitStats(kit?: TaskItem[]) {
  const list = kit ?? [];
  return {
    done: list.filter((item) => item.done).length,
    total: list.length,
  };
}

export function kitComplete(kit?: TaskItem[]) {
  const list = kit ?? [];
  return list.length === 0 || list.every((item) => item.done);
}

export function materialsForStop(data: AppData, stop: Stop) {
  const order = (data.workOrders ?? []).find((item) => item.id === stop.workOrderId);
  return materialsOf(order);
}

export function leadKitOf(data: AppData, stop: Stop) {
  const route = data.routes.find((r) => r.id === stop.routeId);
  const leadId = route?.leadId;
  if (!leadId) return kitFromMaterials(materialsForStop(data, stop));
  const progress = data.progress.find(
    (p) => p.stopId === stop.id && p.technicianId === leadId,
  );
  if (progress?.kit?.length) return progress.kit;
  return kitFromMaterials(materialsForStop(data, stop));
}

export function mergeLeadKit(
  progress: StopProgress,
  materials: KitItem[],
): StopProgress {
  if (!materials.length) return progress;
  if (!progress.kit?.length) {
    return { ...progress, kit: kitFromMaterials(materials) };
  }
  const have = new Set(progress.kit.map((item) => item.id));
  const extra = materials
    .filter((item) => !have.has(item.id))
    .map((item) => ({ id: item.id, label: item.label, done: false }));
  if (!extra.length) return progress;
  return { ...progress, kit: [...progress.kit, ...extra] };
}
