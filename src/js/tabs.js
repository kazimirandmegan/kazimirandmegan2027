/** Tab button groups: elements with [data-tab] / [data-<attr>] */
export function bindTabs(attr, onChange) {
  const buttons = document.querySelectorAll("[" + attr + "]");
  if (!buttons.length) return;
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.getAttribute(attr);
      buttons.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (typeof onChange === "function") onChange(val, btn);
    });
  });
}
