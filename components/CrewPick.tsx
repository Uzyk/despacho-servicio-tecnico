"use client";

import { nameOf, useStore } from "@/lib/store";

export function CrewPick({
  ids,
  selected,
  leadId,
  onChange,
}: {
  ids: string[];
  selected: string[];
  leadId?: string;
  onChange: (next: string[]) => void;
}) {
  const { data } = useStore();

  return (
    <div className="space-y-1">
      {ids.map((id) => {
        const checked = selected.includes(id);
        return (
          <label
            key={id}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                const next = checked
                  ? selected.filter((x) => x !== id)
                  : [...selected, id];
                if (next.length === 0) return;
                onChange(next);
              }}
              className="h-4 w-4 accent-navy"
            />
            <span>
              {nameOf(data.technicians, id)}
              {id === leadId ? " (encargado)" : ""}
            </span>
          </label>
        );
      })}
    </div>
  );
}
