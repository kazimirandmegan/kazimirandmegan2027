/* ============================================================
   KAZIMIR & MEGAN — WEDDING WEBSITE LIVE CLOUD
   ============================================================
   Paste this whole file into Google Apps Script (script.google.com)
   following GOOGLE-DRIVE-SETUP.md. It turns one Google Sheet and one
   Drive folder into a tiny private backend for the website:

     • Guestbook notes and photos  →  "Guestbook" tab + Drive folder
     • Kiko Dash scores            →  "Scores" tab
     • Song requests               →  "Songs" tab
     • RSVPs (one row per household)→  "RSVPs" tab

   The website reads all of it back live, so every guest sees every
   pin, photo and high score within moments — and everything lives
   in YOUR Google account, editable like any spreadsheet.

   RSVPs: each household is one row, keyed by the lead guest's name.
   When a guest edits and resubmits, the SAME row updates (no
   duplicates). Their city + country feeds the Guest Atlas map; the
   full address is stored for you but never shown publicly.

   MODERATION: to remove a guestbook entry, just delete its row in
   the Sheet (and the photo in the Drive folder if there was one).
   It vanishes from the site on the next refresh.
   ============================================================ */

/* Must match SETTINGS.cloudKey in src/config/settings.js. This is light
   protection against random bots, not real security — the site is
   already behind its password gate. */
const SECRET_KEY = "hydrangea";

/* Names created automatically on first use — no setup needed. */
const SHEET_GUESTBOOK = "Guestbook";
const SHEET_SCORES    = "Scores";
const SHEET_SONGS     = "Songs";
const SHEET_RSVPS     = "RSVPs";
const PHOTO_FOLDER    = "Wedding Website Photos";

/* Basic hygiene limits */
const MAX_TEXT   = 1200;      /* characters per guestbook note        */
const MAX_NAME   = 80;
const MAX_PHOTO  = 6*1024*1024; /* ~6MB of base64 — site sends far less */

/* ---------------------------------------------------------- */
/* READ: the website calls  ...?action=guestbook|scores&key=…  */
/* ---------------------------------------------------------- */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (String(p.key || "") !== SECRET_KEY) return reply_({ok:false, error:"bad key"});
    const action = String(p.action || "");
    if (action === "guestbook") return reply_({ok:true, data: readGuestbook_()});
    if (action === "scores")    return reply_({ok:true, data: readScores_()});
    if (action === "songs")     return reply_({ok:true, data: readSongs_()});
    if (action === "rsvp")      return reply_({ok:true, data: readOneRsvp_(p.name)});
    if (action === "atlas")     return reply_({ok:true, data: readAtlas_()});
    if (action === "ping")      return reply_({ok:true, data:"pong"});
    return reply_({ok:false, error:"unknown action"});
  } catch (err) {
    return reply_({ok:false, error:String(err)});
  }
}

/* ---------------------------------------------------------- */
/* WRITE: the website POSTs JSON as text/plain                 */
/* ---------------------------------------------------------- */
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (String(body.key || "") !== SECRET_KEY) return reply_({ok:false, error:"bad key"});
    const action = String(body.action || "");

    /* one-at-a-time so two simultaneous guests can't tangle the sheet */
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (action === "guestbook") return reply_({ok:true, data: addGuestbook_(body)});
      if (action === "score")     return reply_({ok:true, data: addScore_(body)});
      if (action === "song")      return reply_({ok:true, data: addSong_(body)});
      if (action === "rsvp")      return reply_({ok:true, data: saveRsvp_(body)});
      return reply_({ok:false, error:"unknown action"});
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return reply_({ok:false, error:String(err)});
  }
}

/* ---------------------------------------------------------- */
/* Guestbook                                                   */
/* ---------------------------------------------------------- */
function addGuestbook_(b) {
  const who  = clean_(b.who,  MAX_NAME) || "Anonymous";
  const type = ["memory","advice","wish","photo"].indexOf(b.type) >= 0 ? b.type : "memory";
  const text = clean_(b.text, MAX_TEXT);

  let imgUrl = "";
  const photo = String(b.photo || "");
  if (photo.indexOf("data:image/") === 0) {
    if (photo.length > MAX_PHOTO) throw new Error("photo too large");
    imgUrl = savePhoto_(photo, who);
  }
  /* need SOMETHING to pin: words, a photo, or both */
  if (!text && !imgUrl) throw new Error("empty entry");

  /* which wall: "before" the wedding or "after" — defaults to before */
  const phase = (String(b.phase) === "after") ? "after" : "before";

  sheet_(SHEET_GUESTBOOK, ["when","who","type","text","img","phase"])
    .appendRow([new Date(), who, type, text, imgUrl, phase]);
  return "saved";
}

function readGuestbook_() {
  const rows = rows_(SHEET_GUESTBOOK);
  /* newest first, exactly the shape the website's wall expects */
  return rows.reverse().map(function(r){
    return { who: r.who, type: r.type, text: r.text, img: r.img || undefined,
             phase: (String(r.phase) === "after") ? "after" : "before" };
  });
}

function savePhoto_(dataUrl, who) {
  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!m) throw new Error("bad image data");
  /* name the file by its real type (the site sends jpeg, but be honest
     if a png/webp ever arrives) */
  const ext = (m[1].split("/")[1] || "jpg").replace("jpeg", "jpg");
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1],
    "guestbook-" + Date.now() + "-" + who.replace(/[^\w-]+/g, "_").slice(0, 24) + "." + ext);
  const file = folder_().createFile(blob);
  /* anyone WITH THE LINK can view — that's what lets the website
     display it; the folder itself stays private to you */
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  /* this googleusercontent form serves the raw image reliably in <img> tags */
  return "https://lh3.googleusercontent.com/d/" + file.getId();
}

/* ---------------------------------------------------------- */
/* Kiko Dash scores                                            */
/* ---------------------------------------------------------- */
function addScore_(b) {
  const name  = clean_(b.name, MAX_NAME);
  const score = Math.max(0, Math.min(99999, parseInt(b.score, 10) || 0));
  if (!name || !score) throw new Error("missing name/score");
  sheet_(SHEET_SCORES, ["when","name","score"]).appendRow([new Date(), name, score]);
  return "saved";
}

function readScores_() {
  /* best run per guest, highest first */
  const best = {};
  rows_(SHEET_SCORES).forEach(function(r){
    const s = parseInt(r.score, 10) || 0;
    if (!best[r.name] || s > best[r.name]) best[r.name] = s;
  });
  return Object.keys(best)
    .map(function(n){ return {name:n, score:best[n]}; })
    .sort(function(a,b){ return b.score - a.score; })
    .slice(0, 25);
}

/* ---------------------------------------------------------- */
/* Song requests                                               */
/* ---------------------------------------------------------- */
function addSong_(b) {
  const name = clean_(b.name, MAX_NAME) || "Anonymous";
  const song = clean_(b.song, 200);
  if (!song) throw new Error("empty song");
  sheet_(SHEET_SONGS, ["when","name","song"]).appendRow([new Date(), name, song]);
  return "saved";
}

function readSongs_() {
  return rows_(SHEET_SONGS).reverse().map(function(r){
    return { name: r.name, song: r.song };
  });
}

/* ---------------------------------------------------------- */
/* RSVPs — one row per household, upserted by lead-guest name  */
/* ---------------------------------------------------------- */
const RSVP_HEADERS = ["updated","name","key","attending","party_size",
  "email","mobile","city","country","lat","lng","pre_wedding","ceremony",
  "breakfast","evening","afterparty","activities","travelling_after","guests_json",
  "full_address","details_json"];

function saveRsvp_(b) {
  const name = clean_(b.name, MAX_NAME);
  if (!name) throw new Error("missing lead name");
  const key = normKey_(name);

  /* geocode the address to a rough lat/lng + tidy city/country, so the
     atlas can place a pin and measure distance. We deliberately keep
     ONLY city + country for public display; the full address stays in
     its own column for the couple. */
  var city = clean_(b.city, 120), country = clean_(b.country, 120);
  var lat = "", lng = "";
  const addr = clean_(b.address, 400);
  if (addr || city || country) {
    try {
      const q = [addr, city, country].filter(String).join(", ");
      const geo = Maps.newGeocoder().geocode(q);
      if (geo && geo.results && geo.results.length) {
        const r0 = geo.results[0];
        lat = r0.geometry.location.lat;
        lng = r0.geometry.location.lng;
        /* fill city/country from the geocoder if the guest left them blank */
        (r0.address_components || []).forEach(function(c){
          if (!city && c.types.indexOf("locality") >= 0) city = c.long_name;
          if (!city && c.types.indexOf("postal_town") >= 0) city = c.long_name;
          if (!country && c.types.indexOf("country") >= 0) country = c.long_name;
        });
      }
    } catch (e) { /* geocode is best-effort; RSVP still saves without it */ }
  }

  const sh = sheet_(SHEET_RSVPS, RSVP_HEADERS);
  const row = [
    new Date(), name, key,
    clean_(b.attending, 40), (parseInt(b.party_size,10)||0),
    clean_(b.email, 160), clean_(b.mobile, 60),
    city, country, lat, lng,
    yesno_(b.pre_wedding), yesno_(b.ceremony), yesno_(b.breakfast), yesno_(b.evening),
    yesno_(b.afterparty),
    yesno_(b.activities), yesno_(b.travelling_after),
    JSON.stringify(b.guests || []).slice(0, 8000),
    addr,
    JSON.stringify(b.details || {}).slice(0, 4000)
  ];

  /* upsert: find an existing row with this key and overwrite it */
  const data = sh.getDataRange().getValues();
  const keyCol = RSVP_HEADERS.indexOf("key");
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyCol]) === key) {
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return "updated";
    }
  }
  sh.appendRow(row);
  return "saved";
}

function readOneRsvp_(name) {
  const key = normKey_(clean_(name, MAX_NAME));
  if (!key) return null;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RSVPS);
  if (!sh || sh.getLastRow() < 2) return null;
  const data = sh.getDataRange().getValues();
  const H = data.shift().map(function(h){ return String(h).toLowerCase(); });
  const keyCol = H.indexOf("key");
  for (var i = data.length - 1; i >= 0; i--) {   /* latest wins */
    if (String(data[i][keyCol]) === key) return rsvpRowToObj_(H, data[i]);
  }
  return null;
}

function rsvpRowToObj_(H, r) {
  const o = {};
  H.forEach(function(h, i){ o[h] = r[i]; });
  var guests = [], details = {};
  try { guests = JSON.parse(o.guests_json || "[]"); } catch (e) {}
  try { details = JSON.parse(o.details_json || "{}"); } catch (e) {}
  return {
    name: o.name, attending: o.attending, party_size: o.party_size,
    email: o.email, mobile: o.mobile, address: o.full_address,
    city: o.city, country: o.country,
    pre_wedding: o.pre_wedding === "Yes", ceremony: o.ceremony === "Yes",
    breakfast: o.breakfast === "Yes", evening: o.evening === "Yes",
    afterparty: o.afterparty === "Yes",
    activities: o.activities === "Yes", travelling_after: o.travelling_after === "Yes",
    guests: guests, details: details
  };
}

/* public atlas feed: only households that RSVP'd AND geocoded.
   City + country + coordinates only — never the street address. */
function readAtlas_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RSVPS);
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const H = data.shift().map(function(h){ return String(h).toLowerCase(); });
  const iName = H.indexOf("name"), iCity = H.indexOf("city"),
        iCountry = H.indexOf("country"), iLat = H.indexOf("lat"),
        iLng = H.indexOf("lng"), iAtt = H.indexOf("attending");
  const seen = {}, out = [];
  /* iterate last-first so the most recent RSVP per household wins */
  for (var i = data.length - 1; i >= 0; i--) {
    const r = data[i];
    const nm = String(r[iName]);
    const k = normKey_(nm);
    if (seen[k]) continue;
    seen[k] = 1;
    const lat = parseFloat(r[iLat]), lng = parseFloat(r[iLng]);
    if (isNaN(lat) || isNaN(lng)) continue;
    out.push({
      name: nm,
      city: String(r[iCity] || ""),
      country: String(r[iCountry] || ""),
      lat: lat, lng: lng,
      attending: String(r[iAtt] || "")
    });
  }
  return out;
}

function yesno_(v) { return (v === true || v === "Yes" || v === "yes" || v === 1) ? "Yes" : "No"; }
/* Household key from the lead name. MUST keep Unicode letters —
   Ukrainian guests typing "Олена Шевченко" would otherwise all
   normalise to "" and silently overwrite each other's RSVPs.
   \p{L}=any letter, \p{N}=any digit, in any alphabet. */
function normKey_(s) {
  var k = String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  /* belt-and-braces: if a name somehow contains no letters at all,
     fall back to the trimmed lowercase string so distinct inputs
     still get distinct keys */
  return k || String(s || "").toLowerCase().trim();
}

/* ---------------------------------------------------------- */
/* Plumbing                                                    */
/* ---------------------------------------------------------- */
function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function clean_(v, max) {
  var s = String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
  /* SECURITY: a cell that starts with = + - or @ is executed as a
     FORMULA by Google Sheets (e.g. =IMPORTXML can exfiltrate sheet
     data to an attacker's server the moment the couple opens the
     tab). Prefixing an apostrophe makes Sheets store it as literal
     text; getValues() returns it without the apostrophe, so nothing
     changes for the website. */
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const vals = sh.getDataRange().getValues();
  const head = vals.shift().map(function(h){ return String(h).toLowerCase(); });
  return vals.map(function(r){
    const o = {};
    head.forEach(function(h, i){ o[h] = String(r[i] == null ? "" : r[i]); });
    return o;
  }).filter(function(o){ return Object.keys(o).some(function(k){ return o[k]; }); });
}

function folder_() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}
