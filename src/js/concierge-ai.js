/**
 * Ask Connie via OpenAI when a server has a key, otherwise the keyword matcher.
 * The key never lives in this file.
 */
import { SETTINGS } from "../config/settings.js";
import { CLOUD } from "./cloud.js";
import { KB } from "../data/concierge-kb.js";
import { PARTY } from "../data/party.js";
import { STA_PINS, LDN_PINS, DAY_PINS, EUR_PINS } from "../data/maps/map-config.js";

const TIMEOUT_MS = 22000;

function cleanText(raw) {
  return String(raw || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pageToText(page) {
  const clone = page.cloneNode(true);
  clone.querySelectorAll("script, style, svg, canvas, #xw, #quiz").forEach((n) => n.remove());
  clone.querySelectorAll("a[href^='#']").forEach((a) => {
    const href = a.getAttribute("href");
    if (href && a.textContent.indexOf(href) < 0) a.append(" " + href);
  });
  clone.querySelectorAll("h1,h2,h3,h4,h5,p,li,tr,summary,dt,dd").forEach((el) => {
    el.prepend("\n");
  });
  const id = (page.id || "page").replace(/^page-/, "");
  const text = cleanText(clone.textContent);
  return text ? "# Page: " + id + "\n" + text : "";
}

function partyText() {
  const lines = PARTY.map((p) => {
    const stats = (p.stats || []).map((s) => s[0] + " " + s[1]).join(", ");
    return (
      p.role +
      " — " +
      p.name +
      (p.connection ? ". " + p.connection : "") +
      (p.weddingRole ? ". Role: " + p.weddingRole : "") +
      (stats ? ". Top Trumps: " + stats : "")
    );
  });
  return "# Bridal party cards\n" + lines.join("\n");
}

function storyText() {
  const lines = (SETTINGS.storyMap || []).map((p) => p.place + (p.note ? " — " + p.note : ""));
  return lines.length ? "# About Us map\n" + lines.join("\n") : "";
}

function pinText(title, pins) {
  const lines = (pins || []).map((p) => p.n + (p.d ? " — " + p.d : ""));
  return lines.length ? "# " + title + "\n" + lines.join("\n") : "";
}

function kbText(tier) {
  const lines = KB.filter((e) => !e.t || e.t.includes(tier)).map((e) => e.a);
  return lines.length ? "# Curated answers\n" + lines.join("\n") : "";
}

/** Hash routes Connie can offer as markdown links: [Label](#route) */
const PAGE_LINKS = [
  ["home", "Home"],
  ["rsvp", "RSVP"],
  ["about", "About Us"],
  ["party", "Bridal Party"],
  ["generations", "Generations of Love"],
  ["memory", "In Loving Memory"],
  ["bts", "Behind the Scenes"],
  ["thankyous", "Thank Yous"],
  ["week", "Wedding Week"],
  ["vinko", "Vinkopletyny"],
  ["bigday", "The Big Day"],
  ["ceremony", "Ceremony"],
  ["breakfast", "Wedding Breakfast"],
  ["reception", "Evening Reception"],
  ["afterparty", "After Party"],
  ["registry", "Registry"],
  ["guestbook", "Guestbook"],
  ["expl-sta", "Explore St Albans"],
  ["expl-ldn", "Explore London"],
  ["expl-day", "England Day Trips"],
  ["expl-eur", "Explore Europe"],
  ["playlists", "Playlists"],
  ["games", "In-Flight Entertainment"],
  ["faqs", "FAQs"],
  ["stay", "Where to Stay"],
  ["americans", "For Americans"],
  ["ukraine", "For Ukrainians"],
  ["workouts", "Wedding Workouts"],
  ["atlas", "Guest Atlas"],
  ["contact", "Contact"],
];

function pageLinksText() {
  return (
    "# Page links\n" +
    "When pointing guests to a page, write markdown like [Stay page](#stay).\n" +
    PAGE_LINKS.map(([id, label]) => "- [" + label + "](#" + id + ")").join("\n")
  );
}

function buildSiteContext(tier, name) {
  const pages = Array.from(document.querySelectorAll("#site-main .page"))
    .map(pageToText)
    .filter(Boolean);
  const bits = [
    "Wedding of Kazimir and Megan, 29 May 2027, St Albans, England.",
    "Guest name: " + (name && name !== "Guest" ? name : "not given") + ".",
    "Invitation level: " + (tier || "full") + ".",
    "Contact email: " + (SETTINGS.contactEmail || "") + ".",
    SETTINGS.whatsappLink && SETTINGS.whatsappLink.indexOf("PLACEHOLDER") < 0
      ? "WhatsApp group: " + SETTINGS.whatsappLink
      : "",
    SETTINGS.sharedPlaylist ? "Shared Spotify playlist: " + SETTINGS.sharedPlaylist : "",
    pageLinksText(),
    kbText(tier),
    partyText(),
    storyText(),
    pinText("St Albans map", STA_PINS),
    pinText("London map", LDN_PINS),
    pinText("England day trips map", DAY_PINS),
    pinText("Europe map", EUR_PINS),
  ]
    .concat(pages)
    .filter(Boolean);
  return bits.join("\n\n");
}

function interpret(res) {
  if (!res || res.kind !== "json" || !res.json) return { reason: "absent" };
  const j = res.json;
  const answer = j.ok && j.data && j.data.answer;
  if (answer && String(answer).trim()) return { answer: String(answer).trim() };
  if (j.error === "no openai key" || j.error === "unknown action" || j.error === "bad key") {
    return { reason: "nokey" };
  }
  return { reason: "error" };
}

async function postJson(url, payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const text = await r.text();
    try {
      return { kind: "json", json: JSON.parse(text) };
    } catch {
      return { kind: "absent" };
    }
  } catch {
    return { kind: "absent" };
  } finally {
    clearTimeout(timer);
  }
}

export function createConnie({ getTier, getName, localAnswer }) {
  const history = [];
  let contextCache = "";
  let contextTier = "";
  /* unknown | live | nokey | absent */
  let sameOrigin = "unknown";
  let cloudAi = "unknown";

  function siteContext() {
    const tier = getTier() || "full";
    if (contextCache && contextTier === tier) return contextCache;
    contextTier = tier;
    contextCache = buildSiteContext(tier, getName());
    return contextCache;
  }

  function remember(question, text) {
    history.push({ role: "user", content: question });
    history.push({ role: "assistant", content: text });
    if (history.length > 6) history.splice(0, history.length - 6);
  }

  function stillTrying(state) {
    return state === "unknown" || state === "live";
  }

  async function askRemote(question) {
    const payload = {
      question,
      tier: getTier() || "full",
      history: history.slice(),
      context: siteContext(),
    };
    if (stillTrying(sameOrigin)) {
      const got = interpret(await postJson("/api/connie", payload));
      if (got.answer) {
        sameOrigin = "live";
        return got.answer;
      }
      if (got.reason === "nokey" || got.reason === "absent") sameOrigin = got.reason;
    }
    if (CLOUD && stillTrying(cloudAi)) {
      const got = interpret(
        await postJson(SETTINGS.cloudUrl, {
          ...payload,
          action: "connie",
          key: SETTINGS.cloudKey || "",
        })
      );
      if (got.answer) {
        cloudAi = "live";
        return got.answer;
      }
      /* Old script, missing key, or a failed call: don't stall later questions. */
      if (got.reason === "nokey" || got.reason === "absent" || got.reason === "error") cloudAi = "nokey";
    }
    return null;
  }

  return {
    /** @returns {Promise<{text:string, ai:boolean}>} */
    async reply(question) {
      let text = null;
      const canTry = stillTrying(sameOrigin) || (CLOUD && stillTrying(cloudAi));
      if (canTry) {
        try {
          text = await askRemote(question);
        } catch {
          text = null;
        }
      }
      const ai = !!text;
      if (!text) text = localAnswer(question);
      remember(question, text);
      return { text, ai };
    },
  };
}
