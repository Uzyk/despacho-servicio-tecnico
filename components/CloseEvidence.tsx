export function CloseEvidence({
  note,
  photo,
  who,
  compact,
  outcome,
  failReason,
}: {
  note?: string;
  photo?: string;
  who?: string;
  compact?: boolean;
  outcome?: "realizado" | "no_realizado";
  failReason?: string;
}) {
  const text = note?.trim() ?? "";
  const missed = outcome === "no_realizado";
  if (!text && !photo && !missed) return null;
  return (
    <div
      className={
        compact
          ? "mt-1 space-y-1 text-xs text-stone-600"
          : "mt-3 space-y-2 rounded-2xl bg-stone-50 p-3"
      }
    >
      {who ? (
        <p className={compact ? "font-semibold text-navy" : "text-sm font-semibold text-navy"}>
          {who}
        </p>
      ) : null}
      {missed ? (
        <p className={compact ? "font-semibold text-red-800" : "text-sm font-semibold text-red-800"}>
          No se realizó{failReason ? ` · ${failReason}` : ""}
        </p>
      ) : null}
      {text ? (
        <p className={compact ? "whitespace-pre-wrap" : "text-sm whitespace-pre-wrap text-ink"}>
          {text}
        </p>
      ) : null}
      {photo ? (
        <img
          src={photo}
          alt={who ? `Foto de cierre de ${who}` : "Foto de cierre del trabajo"}
          className={
            compact
              ? "mt-1 max-h-28 rounded-lg object-cover"
              : "max-h-56 w-full rounded-xl object-cover"
          }
        />
      ) : null}
    </div>
  );
}
