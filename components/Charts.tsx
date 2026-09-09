import type { ChartBar, ChartSlice } from "@/lib/record";

export function DonutChart({
  title,
  slices,
  center,
}: {
  title: string;
  slices: ChartSlice[];
  center: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const visible = total > 0 ? slices.filter((s) => s.value > 0) : [];

  return (
    <figure className="rounded-2xl bg-stone-50 p-3">
      <figcaption className="mb-2 text-sm font-semibold text-navy">{title}</figcaption>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e7e5e4" strokeWidth="12" />
          {visible.length === 0 ? null : (
            visible.map((s) => {
              const len = (s.value / total) * c;
              const dash = `${len} ${c - len}`;
              const el = (
                <circle
                  key={s.label}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="12"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                />
              );
              offset += len;
              return el;
            })
          )}
          <text
            x="50"
            y="52"
            textAnchor="middle"
            className="fill-navy"
            fontSize="12"
            fontWeight="700"
          >
            {center}
          </text>
        </svg>
        <ul className="space-y-1 text-xs">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: s.color }}
              />
              <span className="text-stone-600">
                {s.label}: {s.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function BarChart({
  title,
  bars,
  format = String,
}: {
  title: string;
  bars: ChartBar[];
  format?: (n: number) => string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <figure className="rounded-2xl bg-stone-50 p-3">
      <figcaption className="mb-3 text-sm font-semibold text-navy">{title}</figcaption>
      {bars.length === 0 ? (
        <p className="text-sm text-stone-500">Aún no hay datos para graficar.</p>
      ) : (
        <ul className="space-y-2">
          {bars.map((b) => (
            <li key={b.label}>
              <div className="mb-0.5 flex justify-between gap-2 text-xs">
                <span className="truncate text-stone-600">{b.label}</span>
                <span className="font-semibold text-navy">{format(b.value)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full rounded-full bg-navy"
                  style={{ width: `${Math.max((b.value / max) * 100, b.value > 0 ? 6 : 0)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
