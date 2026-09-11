"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DEMO_PASSWORD,
  ROLE_HOME,
} from "@/lib/auth";
import { useStore } from "@/lib/store";
import { COMPANY, COMPANY_MARK, PRODUCT } from "@/lib/brand";
import { Input, PrimaryButton } from "./ui";
import { WelcomeOnboard } from "./WelcomeOnboard";

export function LoginScreen() {
  const { account, ready, login } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [intro, setIntro] = useState(true);
  const finishIntro = useCallback(() => setIntro(false), []);

  useEffect(() => {
    if (ready && account) router.replace(ROLE_HOME[account.role]);
  }, [ready, account, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const message = await login(email, password);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
  }

  if (!ready || account) {
    return <p className="p-8 text-stone-600">Cargando…</p>;
  }

  if (intro) {
    return <WelcomeOnboard onDone={finishIntro} />;
  }

  return (
    <div className="onboard-login flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-sm font-bold text-gold">
            {COMPANY_MARK}
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight text-navy">
              {COMPANY}
            </p>
            <p className="text-sm text-stone-500">{PRODUCT} · acceso por correo</p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-navy">Correo</span>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre.apellido@despacho.inacap.cl"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-navy">Clave</span>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <PrimaryButton type="submit" className="w-full" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </PrimaryButton>
        </form>

        <div className="mt-5 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <p className="font-semibold text-navy">Cuentas de demostración</p>
          <ul className="mt-2 space-y-1.5">
            <li>
              Admin: <code className="text-navy">{ADMIN_EMAIL}</code> · clave{" "}
              <code className="text-navy">{ADMIN_PASSWORD}</code>
            </li>
            <li>
              Jefatura y técnicos: su correo institucional · clave{" "}
              <code className="text-navy">{DEMO_PASSWORD}</code>
            </li>
            <li>
              Ej. técnico:{" "}
              <code className="text-navy">camila.diaz@despacho.inacap.cl</code>
            </li>
            <li>
              Ej. jefatura:{" "}
              <code className="text-navy">pablo.leiva@despacho.inacap.cl</code>
            </li>
          </ul>
          <p className="mt-3 text-xs text-stone-500">
            El correo define el rol. El administrador envía enlaces de alta para
            jefatura y terreno.
          </p>
        </div>
      </div>
    </div>
  );
}
