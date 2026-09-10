"use client";

import Link from "next/link";
import { ROLE_LABEL } from "@/lib/auth";
import { useStore } from "@/lib/store";

export function AccountBadge({
  tone = "light",
}: {
  tone?: "light" | "dark";
}) {
  const { account } = useStore();
  if (!account) return null;
  const nameClass = tone === "dark" ? "text-white" : "text-navy";
  const subClass = tone === "dark" ? "text-white/65" : "text-stone-500";
  return (
    <Link
      href="/perfil"
      className={`flex items-center gap-3 rounded-xl ${
        tone === "dark" ? "hover:bg-white/10" : "hover:bg-stone-50"
      } px-1 py-1`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={account.photo}
        alt=""
        className={`h-11 w-11 rounded-full object-cover ${
          tone === "dark" ? "ring-2 ring-white/25" : "ring-1 ring-stone-200"
        }`}
      />
      <span className="min-w-0 text-left">
        <span className={`block truncate text-sm font-semibold ${nameClass}`}>
          {account.name}
        </span>
        <span className={`block truncate text-[11px] ${subClass}`}>
          {account.title || ROLE_LABEL[account.role]}
        </span>
        <span className={`block truncate text-[11px] ${subClass}`}>
          {account.email}
        </span>
      </span>
    </Link>
  );
}

export function UserBar({
  tone = "light",
}: {
  tone?: "light" | "dark";
}) {
  return (
    <div className="flex flex-col items-start">
      <AccountBadge tone={tone} />
    </div>
  );
}
