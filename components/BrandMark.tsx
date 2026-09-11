import { COMPANY } from "@/lib/brand";

export function BrandMark() {
  return (
    <p className="mb-3 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/45">
      <BoltIcon />
      {COMPANY}
    </p>
  );
}

function BoltIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-gold"
      aria-hidden
    >
      <path d="M13 3 5.2 13.4c-.35.46-.02 1.1.55 1.1H11l-1.2 6.2c-.12.64.7 1.04 1.12.54L18.8 10.6c.35-.46.02-1.1-.55-1.1H13l1.08-5.96c.12-.66-.72-1.06-1.14-.54Z" />
    </svg>
  );
}
