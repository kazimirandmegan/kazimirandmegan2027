/* Map route config — pin sets + About Us story map from SETTINGS */
import { STA_PINS } from "./sta-pins.js";
import { LDN_PINS } from "./ldn-pins.js";
import { DAY_PINS } from "./day-pins.js";
import { EUR_PINS } from "./eur-pins.js";

export { STA_PINS, LDN_PINS, DAY_PINS, EUR_PINS };

export function buildStoryPins(storyMap) {
  return (storyMap || []).map((t) => ({
    n: t.place,
    lat: t.lat,
    lng: t.lng,
    cat: t.cat || "travel",
    d: t.note || "",
    img: t.img || "",
  }));
}

export function buildStoryLines(storyPins) {
  const home = storyPins.find((p) => p.cat === "home") || {
    lat: 51.7527,
    lng: -0.3394,
  };
  return storyPins
    .filter((p) => p.cat === "from")
    .map((p) => [
      [p.lat, p.lng],
      [home.lat, home.lng],
    ]);
}

export function buildMaps(storyPins, storyLines) {
  return {
    "expl-sta": {
      el: "map-sta",
      center: [51.753, -0.3],
      zoom: 12,
      pins: STA_PINS,
    },
    "expl-ldn": {
      el: "map-ldn",
      center: [51.509, -0.115],
      zoom: 12,
      pins: LDN_PINS,
    },
    "expl-day": {
      el: "map-day",
      center: [51.65, -0.9],
      zoom: 7,
      pins: DAY_PINS,
    },
    "expl-eur": {
      el: "map-eur",
      center: [50.5, 3.5],
      zoom: 4,
      pins: EUR_PINS,
    },
    about: {
      el: "map-journey",
      center: [45, -35],
      zoom: 2,
      pins: storyPins,
      lines: storyLines,
    },
    atlas: {
      el: "map-atlas",
      center: [30, -20],
      zoom: 2,
      pins: [],
      atlas: true,
    },
  };
}
