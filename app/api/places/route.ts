import {
  formatPlaceLabel,
  placeCity,
  typedHouseNumber,
  withHouseNumber,
  type PlaceHit,
} from "@/lib/places";

export const runtime = "nodejs";

const UA = {
  Accept: "application/json",
  "User-Agent": "despacho-inacap/1.0 (estudio de caso INACAP)",
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    district?: string;
    county?: string;
    state?: string;
    osm_value?: string;
    osm_key?: string;
  };
};

function asPlace(
  hit: PlaceHit & { city?: string; region?: string },
): PlaceHit {
  const city = hit.city?.trim();
  const region = hit.region?.trim();
  return {
    label: hit.label,
    detail: hit.detail,
    lat: hit.lat,
    lng: hit.lng,
    ...(city ? { city } : {}),
    ...(region ? { region } : {}),
  };
}

function fromPhoton(features: PhotonFeature[], number: string): PlaceHit[] {
  return features
    .map((feature) => {
      const coords = feature.geometry?.coordinates;
      const props = feature.properties ?? {};
      if (!coords) return null;
      const [lon, latNum] = coords;
      const label = withHouseNumber(
        formatPlaceLabel({
          ...props,
          housenumber: props.housenumber || number || undefined,
        }),
        number,
      );
      if (!label) return null;
      return asPlace({
        label,
        detail: props.housenumber
          ? props.osm_value || "dirección"
          : number
            ? `n° ${number} en esta calle`
            : props.osm_value || props.osm_key || "",
        lat: latNum,
        lng: lon,
        city: placeCity(props),
        region: props.state,
      });
    })
    .filter((place): place is PlaceHit => Boolean(place));
}

async function searchPhoton(q: string, lat: string | null, lng: string | null, number: string) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "7");
  url.searchParams.set("lang", "es");
  if (lat && lng) {
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lng);
  }
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return fromPhoton(json.features ?? [], number);
}

async function searchNominatim(q: string, number: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "7");
  url.searchParams.set("countrycodes", "cl");
  url.searchParams.set("q", q);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return [];
  const rows = (await res.json()) as {
    lat: string;
    lon: string;
    display_name?: string;
    type?: string;
    address?: {
      amenity?: string;
      hotel?: string;
      tourism?: string;
      road?: string;
      house_number?: string;
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      state?: string;
    };
  }[];
  return rows
    .map((row) => {
      const addr = row.address ?? {};
      const house = addr.house_number || number || undefined;
      const label = withHouseNumber(
        formatPlaceLabel({
          name: addr.amenity || addr.hotel || addr.tourism,
          street: addr.road,
          housenumber: house,
          city: addr.city,
          town: addr.town,
          village: addr.village,
          state: addr.state,
        }) || row.display_name || "",
        number,
      );
      if (!label) return null;
      return asPlace({
        label,
        detail: addr.house_number
          ? row.type ?? "dirección"
          : number
            ? `n° ${number} en esta calle`
            : row.type ?? "",
        lat: Number(row.lat),
        lng: Number(row.lon),
        city: placeCity({
          city: addr.city,
          town: addr.town,
          village: addr.village,
          municipality: addr.municipality,
        }),
        region: addr.state,
      });
    })
    .filter((place): place is PlaceHit => Boolean(place));
}

function uniquePlaces(places: PlaceHit[]) {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = `${place.label}|${place.lat.toFixed(5)}|${place.lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function reversePlace(lat: number, lng: number): Promise<PlaceHit | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return null;
  const row = (await res.json()) as {
    display_name?: string;
    address?: {
      amenity?: string;
      hotel?: string;
      tourism?: string;
      road?: string;
      house_number?: string;
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      state?: string;
    };
  };
  const addr = row.address ?? {};
  const label =
    formatPlaceLabel({
      name: addr.amenity || addr.hotel || addr.tourism,
      street: addr.road,
      housenumber: addr.house_number,
      city: addr.city,
      town: addr.town,
      village: addr.village,
      state: addr.state,
    }) || row.display_name;
  if (!label) return null;
  return asPlace({
    label,
    detail: addr.house_number ? `n° ${addr.house_number}` : "punto en el mapa",
    lat,
    lng,
    city: placeCity({
      city: addr.city,
      town: addr.town,
      village: addr.village,
      municipality: addr.municipality,
    }),
    region: addr.state,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("q") ?? "").trim();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!raw && lat && lng) {
    const place = await reversePlace(Number(lat), Number(lng));
    return Response.json({
      places: place
        ? [place]
        : [
            {
              label: `Punto en el mapa (${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)})`,
              detail: "globo",
              lat: Number(lat),
              lng: Number(lng),
            } satisfies PlaceHit,
          ],
    });
  }

  if (raw.length < 3) return Response.json({ places: [] as PlaceHit[] });
  const number = typedHouseNumber(raw);
  const withCountry = /chile/i.test(raw) ? raw : `${raw}, Chile`;

  let places = await searchPhoton(withCountry, lat, lng, number);
  if (places.length === 0) places = await searchNominatim(withCountry, number);

  if (number) {
    const withoutNumber = raw.replace(new RegExp(`\\s*${number}\\b`), "").trim();
    const streetQuery =
      withoutNumber.length >= 3
        ? /chile/i.test(withoutNumber)
          ? withoutNumber
          : `${withoutNumber}, Chile`
        : "";
    if (streetQuery) {
      let streetHits = await searchPhoton(streetQuery, lat, lng, number);
      if (streetHits.length === 0) {
        streetHits = await searchNominatim(streetQuery, number);
      }
      places = uniquePlaces([...places, ...streetHits]);
    }
  }

  return Response.json({ places: uniquePlaces(places).slice(0, 8) });
}
