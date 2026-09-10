"use client";

import { useState } from "react";
import { uid } from "@/lib/ids";
import type { KitItem } from "@/lib/types";
import { Field, GhostButton, Input } from "./ui";

export function MaterialsField({
  items,
  onChange,
}: {
  items: KitItem[];
  onChange: (next: KitItem[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const label = draft.trim();
    if (!label) return;
    onChange([...items, { id: uid("m"), label }]);
    setDraft("");
  }

  return (
    <Field label="Materiales e implementos a llevar">
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="DVR, cámara, cable, taladro…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <GhostButton type="button" onClick={add} disabled={!draft.trim()}>
          Agregar
        </GhostButton>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-stone-500">
          Agrega cada ítem que el encargado debe verificar en terreno.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm"
            >
              <span className="font-medium text-navy">{item.label}</span>
              <GhostButton
                type="button"
                onClick={() => onChange(items.filter((row) => row.id !== item.id))}
              >
                Quitar
              </GhostButton>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
