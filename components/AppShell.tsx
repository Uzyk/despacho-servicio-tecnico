"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { AccountBadge } from "./UserBar";
import { PortalTopBar } from "./PortalDash";

export type JefaturaTab =
  | "vivo"
  | "rutas"
  | "asignar"
  | "armadas"
  | "calendario"
  | "desempeno"
  | "historial"
  | "directorio"
  | "ot"
  | "catalogos";

const JEFATURA_NAV: { id: JefaturaTab; label: string; icon: ReactNode }[] = [
  { id: "vivo", label: "Operaciones", icon: <IconPulse /> },
  { id: "ot", label: "Órdenes", icon: <IconClipboard /> },
  { id: "rutas", label: "Armar", icon: <IconRoute /> },
  { id: "asignar", label: "Cuadrilla", icon: <IconUsers /> },
  { id: "armadas", label: "Rutas", icon: <IconList /> },
  { id: "calendario", label: "Calendario", icon: <IconCalendar /> },
  { id: "desempeno", label: "Desempeño", icon: <IconChart /> },
  { id: "historial", label: "Historial", icon: <IconClock /> },
  { id: "directorio", label: "Directorio", icon: <IconBook /> },
  { id: "catalogos", label: "Catálogos", icon: <IconGrid /> },
];

export function AppShell({
  tab,
  onTab,
  onReset,
  onSearch,
  children,
}: {
  tab: JefaturaTab;
  onTab: (tab: JefaturaTab) => void;
  onReset: () => void;
  onSearch?: (query: string) => void;
  children: ReactNode;
}) {
  const { account, logout } = useStore();
  const router = useRouter();
  function signOut() {
    logout();
    router.replace("/");
  }
  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-white/10 bg-navy text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="px-3 py-4 lg:px-4">
          <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/45">
            Despacho técnico
          </p>
          <AccountBadge tone="dark" />
          <div className="mt-3 flex flex-wrap gap-1 lg:hidden">
            {account?.role === "admin" ? (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
              >
                Personas
              </Link>
            ) : null}
            <Link
              href="/perfil"
              className="rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Perfil
            </Link>
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Restablecer demo
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:px-3 lg:pb-0">
          {JEFATURA_NAV.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTab(item.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-white text-navy"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className={active ? "text-navy" : "text-white/50"}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="flex flex-col gap-1 border-t border-white/10 p-3 pb-4 lg:pb-14">
          {account?.role === "admin" ? (
            <Link
              href="/admin"
              className="hidden rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white lg:block"
            >
              Personas
            </Link>
          ) : null}
          <Link
            href="/perfil"
            className="hidden rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white lg:block"
          >
            Mi perfil
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="hidden rounded-lg px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white lg:block"
          >
            Restablecer demo
          </button>
          {tab === "vivo" ? (
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              Cerrar sesión
            </button>
          ) : null}
        </div>
      </aside>
      <div className="min-w-0 flex-1 bg-paper">
        <PortalTopBar onSearch={onSearch} />
        <main className="w-full px-4 py-5 lg:px-5">{children}</main>
      </div>
    </div>
  );
}

function IconPulse() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12h3l2-5 3 10 2-5h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 4h6v3H9V4Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconRoute() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8.5 7.5c6 0 1 9 7 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 19c0-3 2.2-5 5-5s5 2 5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M4 10h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V10M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4.5h11a3 3 0 0 1 3 3V19H8a3 3 0 0 0-3 3V4.5Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M5 19h13" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
