"use client";

import {
  allowanceBreakdown,
  allowancesOf,
  missingOvernightMeals,
  routeHasOvernight,
  totalAllowances,
} from "@/lib/allowances";
import { money } from "@/lib/ids";
import { crewIds } from "@/lib/record";
import { useStore } from "@/lib/store";
import type { Route, RouteAllowances } from "@/lib/types";
import { Field, Input } from "./ui";

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        inputMode="numeric"
        min={0}
        step={1000}
        type="number"
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
    </Field>
  );
}

export function AllowancesFields({ route }: { route: Route }) {
  const { data, setRouteAllowances } = useStore();
  const overnight = routeHasOvernight(data, route.id);
  const current = allowancesOf(data, route);
  const crew = Math.max(crewIds(data, route.id).length, 1);
  const missing = missingOvernightMeals(current, overnight);
  const total = totalAllowances(current, crew, overnight);
  const lines = allowanceBreakdown(current, crew, overnight);

  function patch(partial: Partial<RouteAllowances>) {
    setRouteAllowances(route.id, { ...current, ...partial });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-navy">Viáticos del encargado</p>
      <p className="text-xs text-stone-500">
        La comida va por persona. Peajes, combustible y hotel van una vez, con
        la camioneta.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {overnight ? (
          <>
            <MoneyInput
              label="Desayuno"
              value={current.breakfast}
              onChange={(breakfast) => patch({ breakfast })}
            />
            <MoneyInput
              label="Almuerzo"
              value={current.lunch}
              onChange={(lunch) => patch({ lunch })}
            />
            <MoneyInput
              label="Cena"
              value={current.dinner}
              onChange={(dinner) => patch({ dinner })}
            />
          </>
        ) : (
          <MoneyInput
            label="Almuerzo"
            value={current.lunch}
            onChange={(lunch) => patch({ lunch })}
          />
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <MoneyInput
          label="Peajes"
          value={current.tolls}
          onChange={(tolls) => patch({ tolls })}
        />
        <MoneyInput
          label="Combustible"
          value={current.fuel}
          onChange={(fuel) => patch({ fuel })}
        />
        {overnight ? (
          <MoneyInput
            label="Hotel"
            value={current.hotel}
            onChange={(hotel) => patch({ hotel })}
          />
        ) : null}
      </div>
      {overnight && missing.length > 0 ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Si pernoctan, hay que incluir {missing.join(", ")}.
        </p>
      ) : null}
      <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm">
        <p className="font-semibold text-navy">
          Total al encargado: {money(total)}
        </p>
        <ul className="mt-1 space-y-0.5 text-xs text-stone-600">
          {lines.map((line) => (
            <li key={line.label}>
              {line.label}: {money(line.amount)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
