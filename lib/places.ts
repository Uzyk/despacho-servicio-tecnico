export type PlaceHit = {
  label: string;
  detail: string;
  lat: number;
  lng: number;
  city?: string;
  region?: string;
};

export function typedHouseNumber(query: string) {
  const clean = query.replace(/,?\s*chile\b/gi, "").trim();
  const match = clean.match(/(\d{1,6}[A-Za-z]?)(?=\s*,|\s*$)/);
  return match?.[1] ?? "";
}

export function withHouseNumber(label: string, number: string) {
  if (!number) return label;
  if (new RegExp(`\\b${number}\\b`, "i").test(label)) return label;
  const [head, ...rest] = label.split(", ");
  if (/\d{1,6}/.test(head ?? "")) return label;
  return [head ? `${head} ${number}` : number, ...rest].filter(Boolean).join(", ");
}

export function formatPlaceLabel(props: {
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
}) {
  const street = [props.street, props.housenumber].filter(Boolean).join(" ");
  const locality =
    props.city ||
    props.town ||
    props.village ||
    props.municipality ||
    props.district ||
    props.county;
  const parts = [props.name, street, locality, props.state].filter(
    (part, i, all): part is string =>
      Boolean(part) && all.findIndex((x) => x === part) === i,
  );
  return parts.join(", ");
}

export function placeCity(props: {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  district?: string;
  county?: string;
}) {
  return (
    props.city ||
    props.town ||
    props.village ||
    props.municipality ||
    props.district ||
    props.county ||
    ""
  );
}
