import { BASE_COORDS, BASE_LOCATION_ID } from "./geo";
import type { PlaceHit } from "./places";
import type { AppData, Location, Stop, WorkType } from "./types";

export type ChileRegion = {
  id: string;
  name: string;
  capital: string;
  lat: number;
  lng: number;
  zone: "Norte" | "Centro" | "Sur";
  aliases: string[];
};

export const CHILE_REGIONS: ChileRegion[] = [
  {
    id: "loc-arica",
    name: "Arica y Parinacota",
    capital: "Arica",
    lat: -18.4783,
    lng: -70.3126,
    zone: "Norte",
    aliases: ["arica y parinacota", "arica"],
  },
  {
    id: "loc-tarapaca",
    name: "Tarapacá",
    capital: "Iquique",
    lat: -20.2307,
    lng: -70.1357,
    zone: "Norte",
    aliases: ["tarapaca", "iquique"],
  },
  {
    id: "loc-antofagasta",
    name: "Antofagasta",
    capital: "Antofagasta",
    lat: -23.6509,
    lng: -70.3975,
    zone: "Norte",
    aliases: ["antofagasta", "calama"],
  },
  {
    id: "loc-atacama",
    name: "Atacama",
    capital: "Copiapó",
    lat: -27.3668,
    lng: -70.3323,
    zone: "Norte",
    aliases: ["atacama", "copiapo"],
  },
  {
    id: "loc-coquimbo",
    name: "Coquimbo",
    capital: "La Serena",
    lat: -29.9027,
    lng: -71.252,
    zone: "Norte",
    aliases: ["coquimbo", "la serena"],
  },
  {
    id: "loc-valparaiso",
    name: "Valparaíso",
    capital: "Valparaíso",
    lat: -33.0472,
    lng: -71.6127,
    zone: "Centro",
    aliases: ["valparaiso", "vina del mar", "viña del mar"],
  },
  {
    id: "loc-metropolitana",
    name: "RM",
    capital: "Santiago",
    lat: -33.4489,
    lng: -70.6693,
    zone: "Centro",
    aliases: [
      "rm",
      "metropolitana",
      "region metropolitana",
      "metropolitana de santiago",
      "santiago metropolitan",
      "santiago",
    ],
  },
  {
    id: "loc-ohiggins",
    name: "O'Higgins",
    capital: "Rancagua",
    lat: -34.1708,
    lng: -70.7444,
    zone: "Centro",
    aliases: [
      "ohiggins",
      "o higgins",
      "libertador general bernardo o higgins",
      "rancagua",
    ],
  },
  {
    id: "loc-maule",
    name: "Maule",
    capital: "Talca",
    lat: -35.4264,
    lng: -71.6554,
    zone: "Centro",
    aliases: ["maule", "talca", "curico"],
  },
  {
    id: "loc-nuble",
    name: "Ñuble",
    capital: "Chillán",
    lat: -36.6067,
    lng: -72.1034,
    zone: "Sur",
    aliases: ["nuble", "chillan"],
  },
  {
    id: "loc-biobio",
    name: "Biobío",
    capital: "Concepción",
    lat: -36.827,
    lng: -73.0503,
    zone: "Sur",
    aliases: ["biobio", "bio bio", "concepcion"],
  },
  {
    id: "loc-araucania",
    name: "La Araucanía",
    capital: "Temuco",
    lat: -38.7359,
    lng: -72.5904,
    zone: "Sur",
    aliases: ["la araucania", "araucania", "temuco"],
  },
  {
    id: "loc-rios",
    name: "Los Ríos",
    capital: "Valdivia",
    lat: -39.8142,
    lng: -73.2459,
    zone: "Sur",
    aliases: ["los rios", "valdivia"],
  },
  {
    id: "loc-lagos",
    name: "Los Lagos",
    capital: "Puerto Montt",
    lat: -41.4693,
    lng: -72.9424,
    zone: "Sur",
    aliases: ["los lagos", "puerto montt", "osorno"],
  },
  {
    id: "loc-aysen",
    name: "Aysén",
    capital: "Coyhaique",
    lat: -45.5712,
    lng: -72.0685,
    zone: "Sur",
    aliases: ["aysen", "aisen", "coyhaique"],
  },
  {
    id: "loc-magallanes",
    name: "Magallanes",
    capital: "Punta Arenas",
    lat: -53.1638,
    lng: -70.9171,
    zone: "Sur",
    aliases: ["magallanes", "punta arenas", "antartica chilena"],
  },
];

const OLD_CITY_TO_REGION: Record<string, { id: string; city: string }> = {
  "loc-stgo": { id: "loc-metropolitana", city: "Santiago" },
  "loc-valpo": { id: "loc-valparaiso", city: "Valparaíso" },
  "loc-cop": { id: "loc-atacama", city: "Copiapó" },
  "loc-coq": { id: "loc-coquimbo", city: "Coquimbo" },
  "loc-cal": { id: "loc-valparaiso", city: "La Calera" },
  "loc-sa": { id: "loc-valparaiso", city: "San Antonio" },
  "loc-mel": { id: "loc-metropolitana", city: "Melipilla" },
  "loc-lb": { id: "loc-metropolitana", city: "Lo Barnechea" },
  "loc-pa": { id: "loc-metropolitana", city: "Puente Alto" },
  "loc-pud": { id: "loc-metropolitana", city: "Pudahuel" },
  "loc-mai": { id: "loc-metropolitana", city: "Maipú" },
  "loc-cur": { id: "loc-maule", city: "Curicó" },
  "loc-tal": { id: "loc-maule", city: "Talca" },
  "loc-sp": { id: "loc-biobio", city: "San Pedro de la Paz" },
  "loc-pen": { id: "loc-biobio", city: "Penco" },
  "loc-tom": { id: "loc-biobio", city: "Tomé" },
  "loc-sj": { id: "loc-biobio", city: "Santa Juana" },
};

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/region (de |del )?/g, "")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9ñü\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function regionLocations(): Location[] {
  return [
    {
      id: BASE_LOCATION_ID,
      name: "INACAP Santiago Sur (base)",
      zone: "Centro",
      workType: "Traslado",
      equipment: 0,
      lat: BASE_COORDS.lat,
      lng: BASE_COORDS.lng,
    },
    ...CHILE_REGIONS.map((region) => ({
      id: region.id,
      name: region.name,
      zone: region.zone,
      workType: "Instalación y capacitación" as WorkType,
      equipment: 1,
      lat: region.lat,
      lng: region.lng,
    })),
  ];
}

export function orderedLocations(locations: Location[]) {
  const order = [BASE_LOCATION_ID, ...CHILE_REGIONS.map((r) => r.id)];
  return [...locations].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name, "es");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function catalogRegions(locations: Location[]) {
  return orderedLocations(locations).filter((l) => l.id !== BASE_LOCATION_ID);
}

export function catalogBase(locations: Location[]) {
  return locations.find((l) => l.id === BASE_LOCATION_ID) ?? null;
}

export function matchRegionId(text?: string) {
  const key = fold(text ?? "");
  if (!key) return "";
  const hit = CHILE_REGIONS.find(
    (region) =>
      fold(region.name) === key ||
      region.aliases.some((alias) => alias === key || key.includes(alias)),
  );
  return hit?.id ?? "";
}

export function localityOfPlace(place: PlaceHit) {
  const city = place.city?.trim();
  if (city) return city;
  const parts = place.label
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^chile$/i.test(part));
  if (parts.length >= 2) {
    const maybeCity = parts[parts.length - 1];
    if (maybeCity && !matchRegionId(maybeCity)) return maybeCity;
    if (parts.length >= 3) return parts[parts.length - 2];
  }
  return "";
}

export function regionIdOfPlace(place: PlaceHit) {
  return matchRegionId(place.region) || matchRegionId(place.city);
}

export function stopLocality(data: AppData, stop: Stop) {
  const city = stop.city?.trim();
  if (city) return city;
  return (
    data.locations.find((l) => l.id === stop.locationId)?.name ?? stop.locationId
  );
}

export function applyPlaceToStop(data: AppData, stop: Stop, place: PlaceHit): Stop {
  const city = localityOfPlace(place);
  const regionId = regionIdOfPlace(place);
  const keepRegion = stop.workType === "Regreso a base";
  return {
    ...stop,
    city: city || stop.city,
    locationId:
      !keepRegion && regionId && data.locations.some((l) => l.id === regionId)
        ? regionId
        : stop.locationId,
    destLat: place.lat,
    destLng: place.lng,
  };
}

export function migrateLocations(data: AppData): AppData {
  const canonical = regionLocations();
  const known = new Set(canonical.map((l) => l.id));
  const extras = data.locations.filter(
    (l) => !known.has(l.id) && !OLD_CITY_TO_REGION[l.id],
  );
  const locations = orderedLocations([...canonical, ...extras]);
  const oldNames = new Map(data.locations.map((l) => [l.id, l.name]));
  const stops = data.stops.map((stop) => {
    const mapped = OLD_CITY_TO_REGION[stop.locationId];
    if (mapped) {
      return {
        ...stop,
        locationId: mapped.id,
        city: stop.city?.trim() || mapped.city,
      };
    }
    if (!stop.city?.trim() && !known.has(stop.locationId)) {
      const name = oldNames.get(stop.locationId);
      const regionId = matchRegionId(name);
      return {
        ...stop,
        locationId: regionId || stop.locationId,
        city: name,
      };
    }
    return stop;
  });
  return { ...data, locations, stops };
}
