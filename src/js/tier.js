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
  "workouts",
  "atlas",
  "games",
  "rsvp",
  "registry",
  "guestbook",
  "playlists",
  "faqs",
  "contact",
];

export const ACCESS = {
  full: SHARED.concat([
    "bigday",
    "week",
    "vinko",
    "ceremony",
    "breakfast",
    "reception",
    "afterparty",
  ]),
  vinko: SHARED.concat(["vinko"]),
  afterparty: SHARED.concat(["reception", "afterparty"]),
};

export function tierHasCatering(tier) {
  return tier === "full" || tier === "vinko";
}
