import { SETTINGS } from "../config/settings.js";

export function parseCsv(txt) {
  const lines = txt.split(/\r?\n/).filter(Boolean).map((line) =>
    line
      .match(/("([^"]|"")*"|[^,]*)(,|$)/g)
      .filter(Boolean)
      .map((c) =>
        c
          .replace(/,$/, "")
          .replace(/^"|"$/g, "")
          .replace(/""/g, '"')
          .trim()
      )
  );
  const head = lines.shift().map((h) => h.toLowerCase());
  return lines.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] || ""])));
}

export const CLOUD = !!(SETTINGS.cloudUrl && /^https?:\/\//.test(SETTINGS.cloudUrl));

export function cloudGet(action, params) {
  let q =
    SETTINGS.cloudUrl +
    (SETTINGS.cloudUrl.includes("?") ? "&" : "?") +
    "action=" +
    encodeURIComponent(action) +
    "&key=" +
    encodeURIComponent(SETTINGS.cloudKey || "");
  if (params)
    Object.keys(params).forEach((k) => {
      q +=
        "&" +
        encodeURIComponent(k) +
        "=" +
        encodeURIComponent(params[k]);
    });
  return fetch(q)
    .then((r) => r.json())
    .then((j) => {
      if (j && j.ok) return j.data;
      throw new Error((j && j.error) || "cloud error");
    });
}

export function cloudPost(payload) {
  payload.key = SETTINGS.cloudKey || "";
  return fetch(SETTINGS.cloudUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
    .then((r) => r.json())
    .then((j) => {
      if (j && j.ok) return j.data;
      throw new Error((j && j.error) || "cloud error");
    });
}
