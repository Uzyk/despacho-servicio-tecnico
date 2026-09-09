export function mapsUrl(
  query?: string,
  coords?: { lat: number; lng: number } | [number, number] | null,
) {
  const text = (query ?? "").trim();
  const point = Array.isArray(coords)
    ? { lat: coords[0], lng: coords[1] }
    : coords;
  const dest = text
    ? /chile/i.test(text)
      ? text
      : `${text}, Chile`
    : point
      ? `${point.lat},${point.lng}`
      : "";
  if (!dest) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
