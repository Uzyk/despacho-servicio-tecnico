import { addClock, subClock } from "@/lib/hours";

export const runtime = "nodejs";

type Coord = { lat: number; lng: number };

function haversineKm(from: Coord, to: Coord) {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function driveMinutes(km: number) {
  return Math.max(8, Math.round((km / 65) * 60) + 10);
}

async function geocode(query: string): Promise<Coord | null> {
  const q = query.trim();
  if (q.length < 3) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "cl");
  url.searchParams.set("q", q);
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "despacho-inacap/1.0 (estudio de caso INACAP)",
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as { lat: string; lon: string }[];
  const row = rows[0];
  if (!row) return null;
  return { lat: Number(row.lat), lng: Number(row.lon) };
}

async function resolvePoint(lat: string | null, lng: string | null, query: string | null) {
  if (lat && lng) {
    const point = { lat: Number(lat), lng: Number(lng) };
    if (!Number.isNaN(point.lat) && !Number.isNaN(point.lng)) return point;
  }
  if (query) return geocode(query);
  return null;
}

async function osrmMinutes(from: Coord, to: Coord) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&alternatives=false`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    routes?: { duration: number; distance: number }[];
  };
  const route = json.routes?.[0];
  if (!route) return null;
  return {
    minutes: Math.max(5, Math.round(route.duration / 60)),
    km: route.distance / 1000,
    via: "ruta" as const,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const arrive = searchParams.get("arrive") ?? "";
  const depart = searchParams.get("depart") ?? "";
  const clock = arrive || depart;
  const [from, to] = await Promise.all([
    resolvePoint(
      searchParams.get("fromLat"),
      searchParams.get("fromLng"),
      searchParams.get("fromQ"),
    ),
    resolvePoint(
      searchParams.get("toLat"),
      searchParams.get("toLng"),
      searchParams.get("toQ"),
    ),
  ]);
  if (!from || !to) {
    return Response.json({ error: "Sin coordenadas" }, { status: 422 });
  }
  if (!clock) {
    return Response.json({ error: "Sin hora" }, { status: 422 });
  }

  const routed = await osrmMinutes(from, to);
  const km = routed?.km ?? haversineKm(from, to);
  const minutes = routed?.minutes ?? driveMinutes(km);
  const leaveAt = depart && !arrive ? depart : subClock(clock, minutes);
  const etaAt = depart && !arrive ? addClock(depart, minutes) : arrive || clock;

  return Response.json({
    leaveAt,
    etaAt,
    minutes,
    km,
    destLat: to.lat,
    destLng: to.lng,
    via: routed ? "ruta" : "estimado",
  });
}
