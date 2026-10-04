/** Which pages each guest tier can see */
export const SHARED = [
  "home",
  "about",
  "party",
  "generations",
  "memory",
  "bts",
  "thankyous",
  "expl-sta",
  "expl-ldn",
  "expl-day",
  "expl-eur",
  "americans",
  "ukraine",
  "stay",
  "atlas",
  "games",
  "rsvp",
  "registry",
  "guestbook",
  "playlists",
  "faqs",
];

export const ACCESS = {
  full: SHARED.concat([
    "bigday",
    "week",
    "vinko",
    "ceremony",
    "reception",
  ]),
  vinko: SHARED.concat(["vinko"]),
};

export function tierHasCatering(tier) {
  return tier === "full" || tier === "vinko";
}
