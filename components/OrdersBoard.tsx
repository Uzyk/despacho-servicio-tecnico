"use client";

import { useState } from "react";
import { catalogRegions, localityOfPlace, regionIdOfPlace } from "@/lib/regions";
import { coordsOf } from "@/lib/geo";
import {
  WORK_ORDER_STATUS_LABEL,
  workOrderLabel,
  workOrderReady,
} from "@/lib/orders";
import { useStore } from "@/lib/store";
import {
  JOB_TYPES,
  type KitItem,
  type WorkOrder,
  type WorkOrderStatus,
  type WorkType,
} from "@/lib/types";
import { hasSiteAddress, isDispatchWork } from "@/lib/install";
import { kitLine } from "@/lib/kit";
import type { PlaceHit } from "@/lib/places";
import { AddressField } from "./AddressField";
import { MaterialsField } from "./MaterialsField";
import { Card, Field, GhostButton, Input, PrimaryButton, Select } from "./ui";

const STATUS_ORDER: WorkOrderStatus[] = [
  "pendiente",
  "en_ruta",
  "no_realizada",
  "cerrada",
];

export function OrdersBoard() {
  const { data, addWorkOrder, removeWorkOrder } = useStore();
  const regions = catalogRegions(data.locations);
  const [workType, setWorkType] = useState<WorkType>("Instalación");
  const [companyName, setCompanyName] = useState("");
  const [locationId, setLocationId] = useState(
    regions.find((r) => r.id === "loc-metropolitana")?.id ?? regions[0]?.id ?? "",
  );
  const [address, setAddress] = useState("");
  const [installKind, setInstallKind] = useState("");
  const [materials, setMaterials] = useState<KitItem[]>([]);
  const [picked, setPicked] = useState<PlaceHit | null>(null);

  const regionId = regions.some((r) => r.id === locationId)
    ? locationId
    : (regions[0]?.id ?? "");
  const loc = data.locations.find((l) => l.id === regionId);
  const coords = loc ? coordsOf(loc) : null;
  const bias = coords ? { lat: coords[0], lng: coords[1] } : undefined;
  const draft = {
    workType,
    companyName,
    locationId: regionId,
    address,
    installKind,
    materials,
  };
  const canSave = workOrderReady(draft);
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: (data.workOrders ?? []).filter((o) => o.status === status),
  })).filter((g) => g.items.length > 0);

  function onPick(place: PlaceHit) {
    setAddress(place.label);
    setPicked(place);
    const nextRegion = regionIdOfPlace(place);
    if (nextRegion) setLocationId(nextRegion);
  }

  function onCreate() {
    if (!canSave) return;
    addWorkOrder({
      workType,
      companyName,
      locationId: regionId,
      city: picked ? localityOfPlace(picked) : undefined,
      address,
      installKind,
      materials,
      destLat: picked?.lat,
      destLng: picked?.lng,
    });
    setCompanyName("");
    setAddress("");
    setInstallKind("");
    setMaterials([]);
    setPicked(null);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Nueva OT">
        <div className="grid gap-3">
          <Field label="Tipo">
            <Select
              value={workType}
              onChange={(e) => setWorkType(e.target.value as WorkType)}
            >
              {JOB_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Select>
          </Field>
          <Field label="Empresa">
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Nombre de la empresa o recinto…"
            />
          </Field>
          <Field label="Región">
            <Select
              value={regionId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={
              isDispatchWork(workType)
                ? "Dirección de entrega"
                : workType === "Capacitación"
                  ? "Dirección"
                  : "Dirección de la instalación"
            }
          >
            <AddressField
              placeholder="Escribe calle, número o recinto…"
              value={address}
              bias={bias}
              onChange={(next) => {
                setAddress(next);
                setPicked(null);
              }}
              onPick={onPick}
            />
          </Field>
          {hasSiteAddress(workType) ? (
            <Field
              label={
                isDispatchWork(workType)
                  ? "Producto o materiales"
                  : "Tipo de instalación"
              }
            >
              <Input
                value={installKind}
                onChange={(e) => setInstallKind(e.target.value)}
                placeholder={
                  isDispatchWork(workType)
                    ? "DVR, cámaras, cable, kit…"
                    : "Cámaras, alarma, red, DVR…"
                }
              />
            </Field>
          ) : null}
          <MaterialsField items={materials} onChange={setMaterials} />
        </div>
        <PrimaryButton
          className="mt-4 w-full"
          disabled={!canSave}
          onClick={onCreate}
        >
          Crear OT
        </PrimaryButton>
      </Card>

      <div className="space-y-4">
        {grouped.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
            No hay órdenes de trabajo.
          </p>
        ) : (
          grouped.map((group) => (
            <Card key={group.status} title={WORK_ORDER_STATUS_LABEL[group.status]}>
              <ul className="space-y-2">
                {group.items.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    regionName={
                      data.locations.find((l) => l.id === order.locationId)?.name ??
                      order.locationId
                    }
                    onRemove={
                      order.status === "pendiente"
                        ? () => removeWorkOrder(order.id)
                        : undefined
                    }
                  />
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function OrderRow({
  order,
  regionName,
  onRemove,
}: {
  order: WorkOrder;
  regionName: string;
  onRemove?: () => void;
}) {
  return (
    <li className="rounded-xl bg-stone-50 px-3 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-navy">{workOrderLabel(order)}</p>
          <p className="text-stone-600">
            {order.city || regionName}
            {order.address ? ` · ${order.address}` : ""}
            {order.installKind ? ` · ${order.installKind}` : ""}
            {kitLine(order) ? ` · ${kitLine(order)}` : ""}
            {order.routeId ? ` · ${order.routeId}` : ""}
          </p>
        </div>
        {onRemove ? (
          <GhostButton type="button" onClick={onRemove}>
            Quitar
          </GhostButton>
        ) : null}
      </div>
    </li>
  );
}
