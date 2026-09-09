import { mapsUrl } from "@/lib/maps";

export function AddressWithMaps({
  text,
  coords,
  className,
}: {
  text: string;
  coords?: { lat: number; lng: number } | [number, number] | null;
  className?: string;
}) {
  if (!text.trim()) return null;
  return (
    <span className={`inline-flex max-w-full items-start gap-2 ${className ?? ""}`}>
      <span className="min-w-0 flex-1">{text}</span>
      <MapsLink query={text} coords={coords} />
    </span>
  );
}

export function MapsLink({
  query,
  coords,
}: {
  query?: string;
  coords?: { lat: number; lng: number } | [number, number] | null;
}) {
  const href = mapsUrl(query, coords);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir en Google Maps"
      title="Google Maps"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white shadow-sm hover:bg-stone-50"
    >
      <GoogleMapsIcon />
    </a>
  );
}

function GoogleMapsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#34A853"
        d="M12 22s7-6.2 7-12.2C19 5.6 15.9 3 12 3v19z"
      />
      <path
        fill="#FBBC04"
        d="M12 22S5 15.8 5 9.8C5 5.6 8.1 3 12 3v19z"
      />
      <path
        fill="#EA4335"
        d="M12 13.2a4.2 4.2 0 0 0 4.1-5.1L12 3v10.2z"
      />
      <path
        fill="#4285F4"
        d="M12 3 7.9 8.1A4.2 4.2 0 0 0 12 13.2V3z"
      />
      <circle cx="12" cy="9.2" r="2.2" fill="#1A73E8" />
    </svg>
  );
}
