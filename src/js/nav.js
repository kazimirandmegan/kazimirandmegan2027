/** Mobile drawer + desktop nav helpers */
export function isMobileNav() {
  return matchMedia("(max-width:1024px)").matches;
}

export function setNavOpen(open) {
  document.getElementById("nav-links").classList.toggle("open", open);
  document.getElementById("nav-veil").classList.toggle("show", open);
  document.getElementById("menu-btn").classList.toggle("is-open", open);
  document.getElementById("menu-btn").setAttribute("aria-expanded", open);
  document.body.classList.toggle("nav-locked", open);
  if (!open)
    document.querySelectorAll(".ngroup.m-open").forEach((g) =>
      g.classList.remove("m-open")
    );
}
