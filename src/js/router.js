/**
 * Hash router helpers.
 * The live show()/hashchange wiring lives in app.js (needs tier + lazy inits).
 */
import { ACCESS } from "./tier.js";

export function normalizeRoute(route) {
  return route || "home";
}

export function isKnownRoute(route) {
  return ACCESS.full.includes(route);
}

export function allowRoute(tier, route) {
  const allowed = ACCESS[tier] || ["home"];
  return allowed.includes(route);
}
