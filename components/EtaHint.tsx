"use client";

import { useEffect, useRef, useState } from "react";
import { formatEta, type EtaPoint, type EtaResult } from "@/lib/eta";

export function EtaHint({
  origin,
  dest,
  clock,
  mode = "arrive",
  onChange,
}: {
  origin: EtaPoint;
  dest: EtaPoint;
  clock: string;
  mode?: "arrive" | "depart";
  onChange?: (eta: EtaResult | null) => void;
}) {
  const [eta, setEta] = useState<EtaResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const leaving = mode === "depart";

  useEffect(() => {
    if (!clock || (!dest.query && dest.lat == null)) {
      setEta(null);
      onChangeRef.current?.(null);
      return;
    }
    const ctrl = new AbortController();
    const id = window.setTimeout(async () => {
      setStatus("loading");
      const params = new URLSearchParams({
        fromQ: origin.query,
        toQ: dest.query,
      });
      params.set(leaving ? "depart" : "arrive", clock);
      if (origin.lat != null) params.set("fromLat", String(origin.lat));
      if (origin.lng != null) params.set("fromLng", String(origin.lng));
      if (dest.lat != null) params.set("toLat", String(dest.lat));
      if (dest.lng != null) params.set("toLng", String(dest.lng));
      try {
        const res = await fetch(`/api/eta?${params}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error("eta");
        const next = (await res.json()) as EtaResult;
        if (!next.leaveAt) throw new Error("eta");
        setEta(next);
        setStatus("idle");
        onChangeRef.current?.(next);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setEta(null);
        setStatus("error");
        onChangeRef.current?.(null);
      }
    }, 700);
    return () => {
      window.clearTimeout(id);
      ctrl.abort();
    };
  }, [
    clock,
    dest.lat,
    dest.lng,
    dest.query,
    leaving,
    origin.lat,
    origin.lng,
    origin.query,
  ]);

  if (status === "idle" && !eta) return null;

  return (
    <div className="sm:col-span-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-950">
      {status === "loading" && !eta ? (
        <p>
          {leaving
            ? "Calculando hora de llegada con el mapa…"
            : "Calculando hora de salida con el mapa…"}
        </p>
      ) : eta ? (
        <p>
          <span className="font-semibold">
            {formatEta(eta, leaving ? "arrive" : "leave")}
          </span>
          <span className="mt-0.5 block text-xs text-sky-800">
            {leaving
              ? `Saliendo a las ${clock} desde ${origin.label} hacia ${dest.label}`
              : `Desde ${origin.label} para estar a las ${clock} en ${dest.label}`}
            {eta.via === "ruta" ? " · ruta GPS" : " · estimado"}.
          </span>
        </p>
      ) : status === "error" ? (
        <p>
          {leaving
            ? "No pude estimar la hora de llegada. Revisa la dirección o inténtalo de nuevo."
            : "No pude estimar la hora de salida. Revisa la dirección o inténtalo de nuevo."}
        </p>
      ) : null}
    </div>
  );
}
