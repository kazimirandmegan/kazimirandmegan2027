/** Replace [data-name] / greeting slots with the gate name */
export function fillName(name) {
  const first = String(name || "Guest").trim().split(/\s+/)[0] || "Guest";
  document.querySelectorAll("[data-guest-name]").forEach((el) => {
    el.textContent = first;
  });
  return first;
}
