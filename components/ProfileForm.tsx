"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ROLE_HOME, ROLE_LABEL, readPhotoFile } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { GhostButton, Input, PrimaryButton } from "./ui";
import { UserBar } from "./UserBar";

export function ProfileForm() {
  const { account, updateProfile } = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [photo, setPhoto] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account) return;
    setName(account.name);
    setPhone(account.phone);
    setTitle(account.title);
    setCity(account.city);
    setPhoto(account.photo);
  }, [account]);

  if (!account) return null;

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
    setMessage(null);
    const result = await updateProfile({
      name,
      phone,
      title,
      city,
      photo,
      password: password || undefined,
    });
    setBusy(false);
    if (result) {
      setError(result);
      return;
    }
    setPassword("");
    setMessage("Perfil actualizado.");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-2xl flex-col items-start gap-3 px-4 py-3">
          <UserBar />
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={ROLE_HOME[account.role]}
              className="text-sm font-medium text-navy hover:underline"
            >
              Volver
            </Link>
            <p className="text-sm font-semibold text-navy">Mi perfil</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-5 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo || account.photo}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
          <div>
            <p className="text-lg font-semibold text-navy">{account.name}</p>
            <p className="text-sm text-stone-500">
              {ROLE_LABEL[account.role]} · {account.email}
            </p>
          </div>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-navy">Nombre</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-navy">Cargo</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-navy">Teléfono</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-navy">Ciudad</span>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-navy">Foto</span>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => onPhoto(e.target.files?.[0])}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-navy">
              Nueva clave (opcional)
            </span>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
            />
          </label>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          <div className="flex gap-2">
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </PrimaryButton>
            <GhostButton
              type="button"
              onClick={() => {
                setName(account.name);
                setPhone(account.phone);
                setTitle(account.title);
                setCity(account.city);
                setPhoto(account.photo);
                setPassword("");
                setError(null);
                setMessage(null);
              }}
            >
              Deshacer
            </GhostButton>
          </div>
        </form>
      </main>
    </div>
  );
}
