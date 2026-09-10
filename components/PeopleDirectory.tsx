"use client";

import { useEffect, useMemo, useState } from "react";
import { ROLE_LABEL } from "@/lib/auth";
import { useStore } from "@/lib/store";
import type { Account, AccountRole } from "@/lib/types";
import { Input, PageTitle } from "./ui";

const ROLE_ORDER: AccountRole[] = ["admin", "jefatura", "tecnico"];

export function PeopleDirectory({
  includeAdmin = false,
  initialQuery = "",
}: {
  includeAdmin?: boolean;
  initialQuery?: string;
}) {
  const { data, account } = useStore();
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);
  const accounts = data.accounts ?? [];
  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = accounts.filter((person) => {
      if (!includeAdmin && person.role === "admin") return false;
      if (!needle) return true;
      return [person.name, person.email, person.phone, person.title, person.city]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    const map = new Map<AccountRole, Account[]>();
    for (const roleId of ROLE_ORDER) map.set(roleId, []);
    for (const person of visible) {
      const list = map.get(person.role) ?? [];
      list.push(person);
      map.set(person.role, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }
    return ROLE_ORDER.map((roleId) => ({
      role: roleId,
      people: map.get(roleId) ?? [],
    })).filter((group) => group.people.length > 0);
  }, [accounts, includeAdmin, query]);

  return (
    <section className="space-y-5">
      <PageTitle
        title="Directorio"
        hint="Contactos, fotos y cargos del equipo"
      />
      <label className="block max-w-md space-y-1.5">
        <span className="text-sm font-semibold text-navy">Buscar</span>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre, correo o teléfono"
        />
      </label>
      {grouped.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          No hay personas que coincidan.
        </p>
      ) : (
        grouped.map((group) => (
          <div key={group.role}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
              {ROLE_LABEL[group.role]}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.people.map((person) => {
                const mine = account?.id === person.id;
                return (
                  <li
                    key={person.id}
                    className="flex gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={person.photo}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy">
                        {person.name}
                        {mine ? (
                          <span className="ml-1 text-xs font-medium text-gold">
                            Tú
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {person.title}
                        {person.technicianId ? ` · ${person.technicianId}` : ""}
                      </p>
                      <a
                        href={`mailto:${person.email}`}
                        className="mt-1 block truncate text-sm text-navy hover:underline"
                      >
                        {person.email}
                      </a>
                      <a
                        href={`tel:${person.phone.replace(/\s+/g, "")}`}
                        className="block truncate text-sm text-stone-600 hover:underline"
                      >
                        {person.phone}
                      </a>
                      <p className="truncate text-sm text-stone-500">
                        {person.city}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
