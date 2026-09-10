"use client";

import type { FormEvent, ReactNode } from "react";

export function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function PortalTopBar({
  onSearch,
}: {
  onSearch?: (query: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "");
    onSearch?.(value.trim());
  }
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white px-4 py-2.5 lg:px-5">
      <form onSubmit={submit} className="w-full max-w-lg">
        <label className="relative block">
          <span className="sr-only">Buscar colaboradores</span>
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-400">
            <SearchIcon />
          </span>
          <input
            name="q"
            type="search"
            placeholder="Buscar colaboradores"
            className="w-full rounded-full border-0 bg-stone-100 py-2 pl-9 pr-4 text-sm text-ink outline-none ring-1 ring-transparent placeholder:text-stone-400 focus:bg-white focus:ring-navy/20"
          />
        </label>
      </form>
    </header>
  );
}

export function HexPhoto({
  src,
  size = 72,
}: {
  src: string;
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{ width: size, height: size }}
      className="avatar-hex object-cover"
    />
  );
}

export function PortalHeroCard({
  name,
  title,
}: {
  name: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xl font-semibold tracking-tight text-navy">
        ¡Hola, {firstNameOf(name)}!
      </p>
      <p className="mt-0.5 text-sm text-stone-500">{title}</p>
    </div>
  );
}

export function PortalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-navy">
          {title}
        </h2>
        <span className="h-px flex-1 bg-stone-300" />
      </div>
      {children}
    </section>
  );
}

export function PortalCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 bg-navy/[0.04] px-5 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <span className="h-4 w-1 rounded-full bg-gold" />
          {title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </article>
  );
}

export function QuickAction({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left text-sm text-navy hover:bg-stone-50"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-navy">
        {icon}
      </span>
      {label}
    </button>
  );
}

export function ProgressRing({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <svg width="88" height="88" viewBox="0 0 80 80" aria-hidden>
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e7e5e4" strokeWidth="8" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="#16a34a"
        strokeWidth="8"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
      />
      <text
        x="40"
        y="45"
        textAnchor="middle"
        fill="#0e3558"
        fontSize="15"
        fontWeight="700"
      >
        {pct}%
      </text>
    </svg>
  );
}

export function TaskRow({
  index,
  label,
  onClick,
}: {
  index: number;
  label: string;
  onClick?: () => void;
}) {
  const className =
    "flex w-full items-center gap-3 rounded-xl py-1.5 text-left text-sm text-navy hover:bg-stone-50";
  const body = (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-white">
        {String(index).padStart(2, "0")}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

export function PersonRow({
  photo,
  name,
  hint,
}: {
  photo: string;
  name: string;
  hint: string;
}) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <HexPhoto src={photo} size={36} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-navy">{name}</p>
        <p className="truncate text-xs text-stone-500">{hint}</p>
      </div>
    </li>
  );
}

export function MonthBanner({ message }: { message: string }) {
  const month = new Date().toLocaleDateString("es-CL", {
    month: "long",
  });
  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-indigo-50 p-6">
      <p className="text-lg font-semibold capitalize text-navy">{month}</p>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        {message}
      </p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
