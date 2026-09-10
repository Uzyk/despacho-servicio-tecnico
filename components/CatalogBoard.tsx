"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { catalogBase, catalogRegions } from "@/lib/regions";
import { VEHICLE_KINDS, type Vehicle, type VehicleKind, type VehicleStatus } from "@/lib/types";
import {
  VEHICLE_DUTY_LABEL,
  vehicleDutyClass,
  vehicleKindOf,
  vehicleLabel,
  vehicleModel,
  vehicleStatusOf,
} from "@/lib/vehicles";
import { vehicleDutyOf } from "@/lib/availability";
import { Card, Field, Input, PrimaryButton, Select } from "./ui";

type CatalogEdit = "tech" | "loc" | "van" | null;

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function EditToggle({
  open,
  label,
  onToggle,
}: {
  open: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      aria-label={open ? `Cerrar edición de ${label}` : `Editar ${label}`}
      className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
        open ? "bg-navy text-white" : "text-navy hover:bg-stone-100"
      }`}
    >
      {open ? "Listo" : <PencilIcon />}
    </button>
  );
}

function VehicleEditRow({
  vehicle,
  onSave,
  onStatus,
  onRemove,
}: {
  vehicle: Vehicle;
  onSave: (input: { model: string; kind: VehicleKind; plate: string }) => void;
  onStatus: (status: VehicleStatus) => void;
  onRemove: () => void;
}) {
  const [model, setModel] = useState(vehicleModel(vehicle));
  const [kind, setKind] = useState<VehicleKind>(vehicleKindOf(vehicle));
  const [plate, setPlate] = useState(vehicle.plate);
  const status = vehicleStatusOf(vehicle);
  const { data } = useStore();
  const duty = vehicleDutyOf(data, vehicle.id);

  function commit(nextModel = model, nextKind = kind, nextPlate = plate) {
    onSave({ model: nextModel, kind: nextKind, plate: nextPlate });
  }

  return (
    <li className="space-y-2 rounded-xl bg-stone-50 px-3 py-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          aria-label="Modelo"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onBlur={() => commit()}
        />
        <Select
          aria-label="Tipo"
          value={kind}
          onChange={(e) => {
            const next = e.target.value as VehicleKind;
            setKind(next);
            commit(model, next, plate);
          }}
        >
          {VEHICLE_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Select>
        <Input
          aria-label="Patente"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          onBlur={() => commit()}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="w-48">
          <Select
            aria-label="Estado"
            value={status}
            onChange={(e) => onStatus(e.target.value as VehicleStatus)}
          >
            <option value="operativo">Operativo</option>
            <option value="fuera_de_servicio">Fuera de servicio</option>
          </Select>
        </div>
        {duty === "en_terreno" ? (
          <p className="text-xs font-semibold text-amber-800">En terreno</p>
        ) : null}
        <button
          type="button"
          className="text-xs text-red-700 underline"
          onClick={onRemove}
        >
          Eliminar
        </button>
      </div>
    </li>
  );
}

export function CatalogBoard() {
  const {
    data,
    addTechnician,
    addLocation,
    addVehicle,
    removeTechnician,
    removeLocation,
    removeVehicle,
    updateTechnician,
    updateLocation,
    updateVehicle,
    setVehicleStatus,
  } = useStore();

  const [editing, setEditing] = useState<CatalogEdit>(null);
  const [newTech, setNewTech] = useState("");
  const [newLoc, setNewLoc] = useState("");
  const [model, setModel] = useState("");
  const [kind, setKind] = useState<VehicleKind>("Camioneta");
  const [plate, setPlate] = useState("");
  const [notice, setNotice] = useState("");

  function toggle(section: CatalogEdit) {
    setEditing((current) => (current === section ? null : section));
    setNotice("");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-navy">Catálogos</h2>
      </div>
      {notice ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {notice}
        </p>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Card
          title="Técnicos"
          action={
            <EditToggle
              open={editing === "tech"}
              label="técnicos"
              onToggle={() => toggle("tech")}
            />
          }
        >
          {editing === "tech" ? (
            <div className="mb-3 flex gap-2">
              <Input
                placeholder="Nombre"
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
              />
              <PrimaryButton
                type="button"
                onClick={() => {
                  addTechnician(newTech);
                  setNewTech("");
                  setNotice("");
                }}
              >
                +
              </PrimaryButton>
            </div>
          ) : null}
          <ul className="max-h-72 space-y-1 overflow-auto text-sm">
            {data.technicians.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-lg px-1 py-1"
              >
                {editing === "tech" ? (
                  <Input
                    defaultValue={t.name}
                    aria-label={`Nombre de ${t.id}`}
                    onBlur={(e) => updateTechnician(t.id, e.target.value)}
                  />
                ) : (
                  <span>
                    <span className="font-mono text-xs text-stone-500">
                      {t.id}
                    </span>{" "}
                    {t.name}
                  </span>
                )}
                {editing === "tech" ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-red-700 underline"
                    onClick={() => setNotice(removeTechnician(t.id) ?? "")}
                  >
                    Eliminar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Base">
          <p className="text-sm font-medium text-navy">
            {catalogBase(data.locations)?.name ?? "INACAP Santiago Sur (base)"}
          </p>
        </Card>
        <div className="md:col-span-2">
        <Card
          title="Regiones"
          action={
            <EditToggle
              open={editing === "loc"}
              label="regiones"
              onToggle={() => toggle("loc")}
            />
          }
        >
          {editing === "loc" ? (
            <div className="mb-3 flex gap-2">
              <Input
                placeholder="Nueva región"
                value={newLoc}
                onChange={(e) => setNewLoc(e.target.value)}
              />
              <PrimaryButton
                type="button"
                onClick={() => {
                  if (!newLoc.trim()) return;
                  addLocation({
                    name: newLoc.trim(),
                    zone: "Otra",
                    workType: "Instalación y capacitación",
                    equipment: 1,
                  });
                  setNewLoc("");
                  setNotice("");
                }}
              >
                +
              </PrimaryButton>
            </div>
          ) : null}
          <ul className="max-h-72 space-y-1 overflow-auto text-sm">
            {catalogRegions(data.locations).map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-lg px-1 py-1"
              >
                {editing === "loc" ? (
                  <Input
                    defaultValue={l.name}
                    aria-label={`Nombre de ${l.name}`}
                    onBlur={(e) => updateLocation(l.id, e.target.value)}
                  />
                ) : (
                  <span>{l.name}</span>
                )}
                {editing === "loc" ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-red-700 underline"
                    onClick={() => setNotice(removeLocation(l.id) ?? "")}
                  >
                    Eliminar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
        </div>
        <div className="md:col-span-2">
          <Card
            title="Vehículos"
            action={
              <EditToggle
                open={editing === "van"}
                label="vehículos"
                onToggle={() => toggle("van")}
              />
            }
          >
            {editing === "van" ? (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <Field label="Modelo">
                    <Input
                      placeholder="Partner"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    />
                  </Field>
                  <Field label="Tipo">
                    <Select
                      value={kind}
                      onChange={(e) => setKind(e.target.value as VehicleKind)}
                    >
                      {VEHICLE_KINDS.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Patente">
                    <Input
                      placeholder="ABCD12"
                      value={plate}
                      onChange={(e) => setPlate(e.target.value)}
                    />
                  </Field>
                </div>
                <PrimaryButton
                  type="button"
                  className="mb-4 w-full"
                  onClick={() => {
                    addVehicle({ model, kind, plate });
                    setModel("");
                    setPlate("");
                    setNotice("");
                  }}
                >
                  Agregar vehículo
                </PrimaryButton>
              </>
            ) : null}
            <ul className="max-h-80 space-y-2 overflow-auto text-sm">
              {editing === "van"
                ? data.vehicles.map((v) => (
                    <VehicleEditRow
                      key={v.id}
                      vehicle={v}
                      onSave={(input) => updateVehicle(v.id, input)}
                      onStatus={(status) => setVehicleStatus(v.id, status)}
                      onRemove={() => {
                        removeVehicle(v.id);
                        setNotice("");
                      }}
                    />
                  ))
                : data.vehicles.map((v) => {
                    const duty = vehicleDutyOf(data, v.id);
                    return (
                      <li
                        key={v.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2"
                      >
                        <p className="font-semibold text-navy">
                          {vehicleLabel(v)}
                        </p>
                        <p className={`text-xs font-semibold ${vehicleDutyClass(duty)}`}>
                          {VEHICLE_DUTY_LABEL[duty]}
                        </p>
                      </li>
                    );
                  })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
