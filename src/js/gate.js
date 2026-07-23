/**
 * Password gate helpers.
 * Unlock / personalise flow is wired in app.js (touches the whole DOM).
 */
export function normalizePassword(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function firstName(full) {
  const n = String(full || "").trim();
  if (!n) return "Guest";
  return n.split(/\s+/)[0];
}
