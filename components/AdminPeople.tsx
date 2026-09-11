"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { inviteLink, inviteOpen, ROLE_LABEL } from "@/lib/auth";
import { COMPANY } from "@/lib/brand";
import { useStore } from "@/lib/store";
import type { AccountRole } from "@/lib/types";
import { GhostButton, Input, PrimaryButton, Select } from "./ui";
import { PeopleDirectory } from "./PeopleDirectory";
import { UserBar } from "./UserBar";

export function AdminPeople() {
  const { data, createInvite } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<AccountRole, "admin">>("jefatura");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [last, setLast] = useState<{
    name: string;
    email: string;
    link: string;
  } | null>(null);

  const invites = (data.invites ?? []).filter((i) => inviteOpen(i));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCopied(false);
    const result = createInvite({ name, email, role });
    if (result.error || !result.invite) {
      setError(result.error ?? "No se pudo crear la invitación.");
      return;
    }
    const link = inviteLink(result.invite.token);
    setLast({ name: name.trim(), email: email.trim().toLowerCase(), link });
    setName("");
    setEmail("");
  }

  async function copyLink() {
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const mailHref = last
    ? `mailto:${encodeURIComponent(last.email)}?subject=${encodeURIComponent(
        `Invitación a ${COMPANY}`,
      )}&body=${encodeURIComponent(
        `Hola ${last.name},\n\nCrea tu cuenta con este enlace (válido 14 días):\n${last.link}\n`,
      )}`
    : "";

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 px-4 py-3">
          <UserBar />
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-navy">Personas</p>
            <Link
              href="/jefatura"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy hover:bg-stone-50"
            >
              Operaciones
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight text-navy">
            Personas
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            El correo identifica el rol. Copia el enlace o ábrelo en el correo
            de la persona.
          </p>
          <form
            onSubmit={onSubmit}
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-semibold text-navy">Nombre</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-semibold text-navy">Correo</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-navy">Rol</span>
              <Select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as Exclude<AccountRole, "admin">)
                }
              >
                <option value="jefatura">Jefatura</option>
                <option value="tecnico">Técnico</option>
              </Select>
            </label>
            <div className="flex items-end">
              <PrimaryButton type="submit" className="w-full">
                Crear invitación
              </PrimaryButton>
            </div>
          </form>
          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
          {last ? (
            <div className="mt-4 rounded-lg border border-gold/40 bg-amber-50 p-3 text-sm">
              <p className="font-semibold text-navy">
                Enlace para {last.name}
              </p>
              <p className="mt-1 break-all text-stone-700">{last.link}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <GhostButton type="button" onClick={copyLink}>
                  {copied ? "Copiado" : "Copiar enlace"}
                </GhostButton>
                <a
                  href={mailHref}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-stone-50"
                >
                  Abrir correo
                </a>
              </div>
            </div>
          ) : null}
        </section>

        {invites.length > 0 ? (
          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-navy">
              Invitaciones vigentes
            </h2>
            <ul className="mt-3 divide-y divide-stone-100">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium text-navy">{invite.name}</span>
                    <span className="text-stone-500"> · {invite.email}</span>
                  </span>
                  <span className="text-stone-500">
                    {ROLE_LABEL[invite.role]} · vence{" "}
                    {new Date(invite.expiresAt).toLocaleDateString("es-CL")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <PeopleDirectory includeAdmin />
      </main>
    </div>
  );
}
