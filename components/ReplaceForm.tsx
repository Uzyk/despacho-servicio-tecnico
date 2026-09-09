"use client";

import { useState } from "react";
import { freeTechniciansForRoute } from "@/lib/availability";
import { nameOf, useStore } from "@/lib/store";
import { FAIL_REASONS } from "@/lib/types";
import { GhostButton, PrimaryButton, Select } from "./ui";

export function ReplaceForm({
  routeId,
  fromId,
  onDone,
}: {
  routeId: string;
  fromId: string;
  onDone?: () => void;
}) {
  const { data, replaceTechnician } = useStore();
  const options = freeTechniciansForRoute(data, routeId);
  const [toId, setToId] = useState(options[0]?.id ?? "");
  const [reason, setReason] = useState<(typeof FAIL_REASONS)[number]>(
    "No se presentó",
  );
  const chosen = options.some((t) => t.id === toId)
    ? toId
    : (options[0]?.id ?? "");

  if (options.length === 0) {
    return (
      <p className="text-xs text-stone-500">
        No hay otro técnico libre cerca.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-stone-50 p-3">
      <p className="text-xs font-semibold text-navy">
        Reemplazar a {nameOf(data.technicians, fromId)}
      </p>
      <Select
        value={chosen}
        onChange={(e) => setToId(e.target.value)}
      >
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      <Select
        value={reason}
        onChange={(e) =>
          setReason(e.target.value as (typeof FAIL_REASONS)[number])
        }
      >
        {FAIL_REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>
      <div className="flex gap-2">
        <PrimaryButton
          type="button"
          className="text-sm"
          disabled={!chosen}
          onClick={() => {
            replaceTechnician({ routeId, fromId, toId: chosen, reason });
            onDone?.();
          }}
        >
          Confirmar reemplazo
        </PrimaryButton>
        {onDone ? (
          <GhostButton type="button" onClick={onDone}>
            Cancelar
          </GhostButton>
        ) : null}
      </div>
    </div>
  );
}
