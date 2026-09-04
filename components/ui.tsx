import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-navy">{label}</span>
      {children}
    </label>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-ink shadow-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 ${props.className ?? ""}`}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-ink shadow-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 ${props.className ?? ""}`}
    />
  );
}

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl bg-navy px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-navy-2 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-stone-50 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Card({
  title,
  children,
  hint,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      {title ? (
        <h2 className="mb-1 text-lg font-bold text-navy">{title}</h2>
      ) : null}
      {hint ? <p className="mb-4 text-sm text-stone-600">{hint}</p> : null}
      {children}
    </section>
  );
}
