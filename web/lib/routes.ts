import type { Role } from "./auth";

/**
 * Who may open what.
 *
 * The split is not cosmetic — it follows the product's three jobs. A
 * volunteer runs screenings for the person in front of them. A patient
 * ("user") runs the same screening on themselves. An admin runs the
 * programme and never needs an individual's exercise plan. Each role's
 * navigation only ever contains routes that role can open.
 */
export type Access = "public" | Role;

export const ROUTE_ACCESS: { prefix: string; access: Access | Access[] }[] = [
  { prefix: "/login", access: "public" },
  { prefix: "/volunteer", access: "volunteer" },
  { prefix: "/screening", access: ["volunteer", "user"] },
  { prefix: "/user", access: "user" },
  { prefix: "/admin", access: "admin" },
  { prefix: "/dashboard", access: "admin" },
  { prefix: "/registry", access: "admin" },
];

export function accessFor(path: string): Access | Access[] {
  if (path === "/") return "public";
  const hit = ROUTE_ACCESS.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`));
  return hit?.access ?? "public";
}

export function canOpen(path: string, role: Role | null): boolean {
  const need = accessFor(path);
  if (need === "public") return true;
  const allowed = Array.isArray(need) ? need : [need];
  return role !== null && allowed.includes(role);
}
