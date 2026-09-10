"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  inviteOpen,
  readPhotoFile,
  ROLE_HOME,
  ROLE_LABEL,
} from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Input, PrimaryButton } from "./ui";

export function JoinForm() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const { data, ready, acceptInvite } = useStore();
  const router = useRouter();
  const invite = useMemo(
    () => data.invites.find((i) => i.token === token),
    [data.invites, token],
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Santiago");
  const [password, setPassword] = useState("");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return <p className="p-8 text-stone-600">Cargando…</p>;

  if (!token || !invite || !inviteOpen(invite)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold text-navy">Invitación no válida</p>
        <p className="mt-2 text-sm text-stone-600">
          El enlace venció, ya se usó o no existe. Pide uno nuevo a
          administración.
        </p>
      </div>
    );
  }

  const current = invite;

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await readPhotoFile(file));
    } catch {
      setError("No se pudo leer la foto.");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await acceptInvite({
      token,
      password,
      phone,
      photo,
      name: name || current.name,
      city,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace(ROLE_HOME[current.role]);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <p className="text-lg font-semibold tracking-tight text-navy">
        Crear cuenta
      </p>
      <p className="mt-1 text-sm text-stone-600">
        {current.name} · {current.email} · {ROLE_LABEL[current.role]}
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-5 space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
      >
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-navy">Nombre</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={current.name}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-navy">Teléfono</span>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+56 9 0000 0000"
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-navy">Ciudad</span>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-navy">Clave</span>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-navy">Foto</span>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => onPhoto(e.target.files?.[0])}
          />
        </label>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="h-20 w-20 rounded-xl object-cover"
          />
        ) : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <PrimaryButton type="submit" className="w-full" disabled={busy}>
          {busy ? "Creando…" : "Crear cuenta"}
        </PrimaryButton>
      </form>
    </div>
  );
}
