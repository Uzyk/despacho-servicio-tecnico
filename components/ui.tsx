import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="block space-y-1.5">
      <span className="text-sm font-semibold text-navy">{label}</span>
      {children}
    </div>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15 ${props.className ?? ""}`}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15 ${props.className ?? ""}`}
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
      className={`rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-2 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
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
      className={`rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-navy transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Card({
  title,
  children,
  hint,
  action,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      {title || action ? (
        <div className="mb-1 flex items-start justify-between gap-2">
          {title ? (
            <h2 className="text-base font-semibold tracking-tight text-navy">{title}</h2>
          ) : null}
          {action}
        </div>
      ) : null}
      {hint ? <p className="mb-4 text-sm text-stone-600">{hint}</p> : null}
      {children}
    </section>
  );
}

export function PageTitle({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold tracking-tight text-navy">{title}</h1>
      {hint ? <p className="mt-0.5 text-sm text-stone-500">{hint}</p> : null}
    </div>
  );
}
