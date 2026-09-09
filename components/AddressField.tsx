"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { BASE_COORDS } from "@/lib/geo";
import { typedHouseNumber, withHouseNumber, type PlaceHit } from "@/lib/places";
import { Input } from "./ui";

const PlacePickerMap = dynamic(
  () => import("./PlacePickerMap").then((mod) => mod.PlacePickerMap),
  {
    ssr: false,
    loading: () => (
      <p className="px-3 py-10 text-center text-sm text-stone-500">
        Cargando mapa…
      </p>
    ),
  },
);

export function AddressField({
  value,
  onChange,
  onPick,
  bias,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick?: (place: PlaceHit) => void;
  bias?: { lat: number; lng: number } | null;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const skipSearch = useRef(false);
  const center = bias ?? BASE_COORDS;

  useEffect(() => {
    if (showMap) return;
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const id = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ q });
      if (bias) {
        params.set("lat", String(bias.lat));
        params.set("lng", String(bias.lng));
      }
      try {
        const res = await fetch(`/api/places?${params}`, { signal: ctrl.signal });
        const json = (await res.json()) as { places?: PlaceHit[] };
        const number = typedHouseNumber(q);
        setHits(
          (json.places ?? []).map((hit) => ({
            ...hit,
            label: withHouseNumber(hit.label, number),
          })),
        );
        setActive(0);
        setOpen(true);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") setHits([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(id);
      ctrl.abort();
    };
  }, [bias?.lat, bias?.lng, showMap, value]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(place: PlaceHit) {
    skipSearch.current = true;
    const label = withHouseNumber(place.label, typedHouseNumber(value));
    onChange(label);
    onPick?.({ ...place, label });
    setPin({ lat: place.lat, lng: place.lng });
    setHits([]);
    setOpen(false);
  }

  async function dropOnMap(lat: number, lng: number) {
    skipSearch.current = true;
    setPin({ lat, lng });
    setOpen(false);
    setLocating(true);
    try {
      const res = await fetch(`/api/places?lat=${lat}&lng=${lng}`);
      const json = (await res.json()) as { places?: PlaceHit[] };
      const place = json.places?.[0] ?? {
        label: `Punto en el mapa (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        detail: "globo",
        lat,
        lng,
      };
      skipSearch.current = true;
      onChange(place.label);
      onPick?.({ ...place, lat, lng });
    } catch {
      skipSearch.current = true;
      const label = `Punto en el mapa (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      onChange(label);
      onPick?.({ label, detail: "globo", lat, lng });
    } finally {
      setLocating(false);
    }
  }

  function useTyped() {
    const typed = value.trim();
    if (!typed) return;
    const match = hits.find((hit) =>
      hit.label.toLowerCase().includes(typed.toLowerCase()),
    );
    pick(
      match ?? {
        label: typed,
        detail: "dirección escrita",
        lat: hits[0]?.lat ?? bias?.lat ?? -33.45,
        lng: hits[0]?.lng ?? bias?.lng ?? -70.67,
      },
    );
  }

  const showList =
    !showMap &&
    open &&
    (hits.length > 0 || loading || value.trim().length >= 3);

  return (
    <div ref={boxRef}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            value={value}
            placeholder={placeholder}
            aria-label={ariaLabel}
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listId}
            autoComplete="off"
            onFocus={() => {
              if (!showMap) setOpen(true);
            }}
            onChange={(e) => {
              onChange(e.target.value);
              if (!showMap) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (open && hits[active]) pick(hits[active]);
                else useTyped();
                return;
              }
              if (!open || hits.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => (i + 1) % hits.length);
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => (i - 1 + hits.length) % hits.length);
              }
            }}
          />
          {showList ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
            >
              <li>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-navy"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={useTyped}
                >
                  <span className="font-medium">Usar esta dirección</span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {value.trim()}
                  </span>
                </button>
              </li>
              {loading && hits.length === 0 ? (
                <li className="px-3 py-2 text-sm text-stone-500">
                  Buscando en el mapa…
                </li>
              ) : (
                hits.map((hit, i) => (
                  <li key={`${hit.lat}-${hit.lng}-${hit.label}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      className={`block w-full px-3 py-2 text-left text-sm ${
                        i === active ? "bg-sky-50 text-navy" : "text-ink"
                      }`}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(hit)}
                    >
                      <span className="font-medium">{hit.label}</span>
                      {hit.detail ? (
                        <span className="mt-0.5 block text-xs text-stone-500">
                          {hit.detail}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          className={`inline-flex w-11 shrink-0 items-center justify-center self-stretch rounded-xl border p-0 leading-none ${
            showMap
              ? "border-navy bg-navy text-white hover:bg-navy-2"
              : "border-stone-300 bg-white text-navy hover:bg-stone-50"
          }`}
          aria-label={showMap ? "Cerrar mapa" : "Elegir en el mapa"}
          aria-pressed={showMap}
          title={showMap ? "Cerrar mapa" : "Elegir en el mapa"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpen(false);
            setShowMap((openMap) => !openMap);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="block h-5 w-5"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 2.5c-3.6 0-6.5 2.8-6.5 6.3 0 4.7 6.5 12.7 6.5 12.7s6.5-8 6.5-12.7c0-3.5-2.9-6.3-6.5-6.3zm0 8.6a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6z" />
          </svg>
        </button>
      </div>
      {showMap ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-stone-200">
          <PlacePickerMap center={center} pin={pin} onDrop={dropOnMap} />
          <div className="border-t border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-[11px] font-semibold tracking-wide text-navy uppercase">
              {locating ? "Buscando dirección…" : "Dirección del globo"}
            </p>
            <p className="mt-0.5 text-sm text-ink">
              {value.trim() || "—"}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
