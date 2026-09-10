import type { Account, AccountRole, Invite } from "./types";

export const SESSION_KEY = "despacho-inacap-session";
export const ADMIN_EMAIL = "admin@despacho.inacap.cl";
export const ADMIN_PASSWORD = "Admin2026";
export const DEMO_PASSWORD = "inacap";
export const ADMIN_PASSWORD_HASH =
  "059a50ce956b7ec61527c7ecc0c55b5a009dc54ab4acddce8852b46baa2aba30";
export const DEMO_PASSWORD_HASH =
  "ec32beb6502ad101b634ad8b70b5030d2173b436632fd88b6553d6630f3b0957";

export const ROLE_LABEL: Record<AccountRole, string> = {
  admin: "Administración",
  jefatura: "Jefatura",
  tecnico: "Técnico",
};

export const ROLE_HOME: Record<AccountRole, string> = {
  admin: "/admin",
  jefatura: "/jefatura",
  tecnico: "/tecnico",
};

const AVATAR_COLORS = [
  "#0e3558",
  "#164a73",
  "#b45309",
  "#047857",
  "#6d28d9",
  "#be123c",
  "#0369a1",
  "#4338ca",
];

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function emailFromName(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "");
  return `${slug}@despacho.inacap.cl`;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "D";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? "");
  return `${first}${last}`.toUpperCase();
}

export function avatarDataUrl(name: string) {
  const color =
    AVATAR_COLORS[
      Math.abs(
        [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0),
      ) % AVATAR_COLORS.length
    ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${color}"/><text x="32" y="40" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="22" font-weight="700" fill="#fff">${initialsOf(name)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function hashPassword(plain: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(plain),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function inviteLink(token: string, origin = "") {
  const base = origin || (typeof window === "undefined" ? "" : window.location.origin);
  return `${base}/unirse?t=${encodeURIComponent(token)}`;
}

export function inviteOpen(invite: Invite, now = Date.now()) {
  return !invite.usedAt && invite.expiresAt > now;
}

export function makeAccount(input: {
  id: string;
  email: string;
  role: AccountRole;
  name: string;
  phone: string;
  title: string;
  city?: string;
  technicianId?: string;
  passwordHash?: string;
}): Account {
  return {
    id: input.id,
    email: normalizeEmail(input.email),
    passwordHash: input.passwordHash ?? DEMO_PASSWORD_HASH,
    role: input.role,
    name: input.name,
    phone: input.phone,
    title: input.title,
    city: input.city ?? "Santiago",
    photo: avatarDataUrl(input.name),
    technicianId: input.technicianId,
    createdAt: 1,
  };
}

export function readPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}
