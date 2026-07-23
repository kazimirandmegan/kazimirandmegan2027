# Developer Notes — Kazimir & Megan wedding website

For any developer reviewing or extending this codebase. Written to be read in
ten minutes. For a plain-language overview (including how to run locally),
start with the root [README.md](../README.md).

## Architecture in one paragraph

Vite + vanilla JS SPA. Source lives under `src/`; `npm run build` emits static
files to `dist/` for Netlify. Pages are HTML partials under `src/pages/`
included into `src/index.html` at build/dev time. CSS is split under
`src/css/`. Owner-editable config is `src/config/settings.js`. Interactive
behaviour boots from `src/main.js` → `src/js/app.js`, with helpers in
`src/js/*` and editable lists in `src/data/`. Optional sidecar files in
`public/`: `wall.json` (guestbook fallback) and flat `images_*.jpg` photos.
External runtime dependencies (all optional, all degrade gracefully): Google
Fonts, Leaflet 1.9.4 + OpenStreetMap tiles, open-meteo.com (weather), Spotify
embeds. Client state lives in `sessionStorage` (auth tier, per tab) and
`localStorage` (name, guestbook pins, game scores, hunt progress) via the
guarded `store`/`lstore` wrappers in `src/js/storage.js`.

## Project map

1. **`src/config/settings.js`** — passwords, wedding date, contact links,
   guests, playlists, matchBoard, guestbookWall, cloudUrl / cloudKey, CSV
   fallbacks.
2. **`src/pages/*.html`** — one file per hash route (`#home` → `home.html`,
   etc.), each a `<section class="page" id="page-…">` (optional `data-tier`).
3. **`src/partials/` + `src/index.html`** — gate, nav, footer, Connie, overlays;
   Vite HTML-include plugin expands `<!-- include:… -->`.
4. **`src/css/`** — tokens, base, layout, components, effects.
5. **`src/js/app.js`** — gate, router, tier filter, RSVP, guestbook, maps,
   Connie, games orchestration. Supporting modules: `storage.js`, `cloud.js`,
   `tier.js`, plus smaller helpers and `games/`.
6. **`src/data/`** — QUIZ, KB/SYN, PARTY, HUNT, XW_WORDS, map pins, RSVP
   event/diet lists (marked for editing).
7. **`backend/Code.gs`** — optional Google Apps Script (Sheets + Drive).
8. **`public/`** — static assets copied into `dist/` (photos, optional
   `wall.json`).

## Auth & tiering (important caveat)

Three shared passwords in `SETTINGS.passwords` map to tiers `full | vinko |
afterparty`. At unlock, `applyTier()` **removes** every element whose
`data-tier` attribute excludes the tier (including whole page sections), and
the router refuses non-tier routes. The guest's **name** (free text at the
gate) personalises greetings, games and the concierge; it is
identity, not authentication. **This is front-door privacy only**: passwords
and gated content are readable in the page source. If real separation is ever
required: host-level protection (Netlify) or one deployment per tier.

## Data integrations — how to wire them

**The live-data pattern (v6, replaces email round-trips).** Everything
user-generated now flows: Google Form → responses Sheet → File → Share →
Publish to web → CSV → paste the CSV URL into SETTINGS. The site fetches
these CSVs on every load, so new entries appear for everyone WITHOUT
redeploying. Published-sheet CSV endpoints are CORS-open. The shared
`parseCsv()` handles quoted commas. Wired consumers:
- `guestbookCsv` (who,type,text,img) → the wall, live; `guestbookFormUrl`
  becomes the wall's submit button. Priority: live CSV → wall.json →
  SETTINGS inline list.
- `scoreCsv` (name,score) → Kiko Dash's "official wedding-wide tally"
  (top 10) rendered under the local top-5; `scoreFormUrl` is a Google
  Forms PRE-FILLED link with literal `{name}` and `{score}` tokens the
  site substitutes (Forms → ⋮ → Get pre-filled link, fill dummy values,
  copy, then swap the dummies for the tokens).
- `songFormUrl` — same pattern with `{song}` and `{name}`.
- `guestMapCsv` (name,place,lat,lng) → live pins on the Guest Atlas.
- `guestSheetCsv` (name,rsvp,table,note) → dashboard personalisation.


**RSVP → Google Forms.** Create three Forms (full / vinko / afterparty),
collecting names, dietary needs, song requests. Copy each form's share URL
into `SETTINGS.rsvpLinks`. Every RSVP button site-wide wires itself from
those three strings at load (`.rsvp-full/.rsvp-vinko/.rsvp-afterparty`
classes). Responses land in linked Google Sheets automatically. Optional
upgrade: pre-fill the name field via Forms' pre-filled-link feature by
appending `&entry.<id>=` + `encodeURIComponent(NAME)` — `NAME` is the global
set at the gate; a developer can add this in the settings-wiring block in
~5 lines.

**Guest list → Google Sheets.** Make a sheet with header row
`name,rsvp,table,note`. File → Share → Publish to web → CSV; paste the URL
into `SETTINGS.guestSheetCsv`. On load the site fetches and parses it
(naive CSV parser handles quoted commas) and it replaces `SETTINGS.guests`
for dashboard personalisation. Failure falls back silently to the inline
list. Matching is by normalised name (case/space-insensitive `norm()`).

**Guestbook at scale.** Permanent wall = `wall.json` in `public/`
(array of `{who, type: memory|advice|wish, text, img?}`); falls back to
`SETTINGS.guestbookWall` if the fetch fails (including on `file://`).
Photos are files in `public/` with flat `images_*.jpg` names,
never inlined. Rendering batches 24 with a
"Show more" button; images are `loading="lazy"`. Guest-side pins are
canvas-downscaled to ≤900px JPEG q0.78 before `localStorage` (cap: 20,
oldest evicted; photo dropped with a toast if quota still hit). Submission
to the couple is `mailto:`. True multi-user uploads would need a backend
(Netlify Forms/Blobs or Supabase — clean seam: replace `gbLocal()`/the pin
handler); the shared Google Photos album (`SETTINGS.photoAlbum`) is the
recommended zero-backend answer for post-wedding photo volume.

**Weather** is open-meteo.com (no key, CORS-open), fetched every 15 min.
**Map** is Leaflet + OSM tiles, lazily initialised on first visit to
`#fieldguide` (guarded `typeof L === "undefined"` fallback text offline).

## Games & eggs

Crossword: `XW_WORDS` is the single source (grid 8×13 drawn from it;
layout hand-verified so every ≥2-cell run is a clue word); progress persists
in `localStorage`. Kiko Dash: rAF canvas runner, pointer/Space controls
(suppressed while typing in crossword inputs), local top-5 with the gate
NAME, `mailto:` score submission for the cross-guest tally. Hunt: six
`button.hunt-token` elements on all-tier pages, ids matching the `HUNT`
riddle list; completion reveals codeword BARVINOK. Other eggs: wax seal,
typing "budmo", the 🐾, the "Do not press" button, the countdown-sleeps
click, the runaway bus, the tab-title wink.

## The phone-password bug, fixed properly

Root causes addressed: (1) the gate is now a real `<form>` with a submit
handler, so the iOS/Android keyboard's Go/Return key works, not just the
button; (2) inputs carry `autocapitalize="none"` and comparison strips
case/whitespace; (3) all storage is try/caught (private browsing used to
throw and kill the handler); (4) a `<noscript>` card explains the one truly
unfixable case — the iCloud Files *preview*, which renders HTML without
executing any JavaScript. The reliable guest experience is the hosted URL,
not the raw file.

## Testing & deployment

Tested historically headless-Chromium at 1280px and 390px, all three tiers:
routing, tier DOM-removal, gate (Enter key, case/space fuzz), guestbook
pin/quota path, crossword reveal/check, runner loop, full hunt completion,
tabs, zero horizontal overflow. No automated suite ships in the repo.

**Local:** `npm install` → `npm run dev`.  
**Production:** `npm run build`, then deploy `dist/` to Netlify (see
`netlify.toml`). Put photos and optional `wall.json` in `public/` so they
are copied into `dist/`. Filenames are case-sensitive once hosted.

## Known debts (deliberate)

The concierge KB duplicates page facts — update both. `mailto:` flows
depend on a configured mail client. Crossword has no keyboard auto-advance.
Interactive behaviour is still largely orchestrated in `src/js/app.js`
(helpers are split out; further modularisation is welcome).

---

# v8 developer notes

## The live cloud (replaces the CSV/Form pattern when configured)

`backend/Code.gs` is a Google Apps Script web app bound to a spreadsheet, deployed
"execute as me / anyone has access". Endpoints:

- `GET  ?action=guestbook|scores|songs|ping&key=…` → `{ok, data}` JSON.
- `POST` JSON body `{action, key, …}` with **Content-Type text/plain** —
  deliberately, because that is the one content type browsers send
  cross-origin without a CORS preflight, and Apps Script web apps cannot
  answer preflights. GETs work because the anonymous
  googleusercontent.com response carries `Access-Control-Allow-Origin: *`.

Data layout: tabs `Guestbook (when,who,type,text,img)`,
`Scores (when,name,score)`, `Songs (when,name,song)`, created on first
write. Photos: base64 data-URLs decoded to files in a Drive folder
("Wedding Website Photos"), set to anyone-with-link view, served back as
`https://lh3.googleusercontent.com/d/<fileId>` which renders directly in
`<img>`. `LockService` serialises concurrent writes; inputs are trimmed,
length-capped and type-whitelisted. `SECRET_KEY` must equal
`SETTINGS.cloudKey` — bot deterrence, not security (the site is
client-side; treat the sheet as moderated, not trusted).

Site side: `CLOUD` flag + `cloudGet()/cloudPost()` live next to
`parseCsv()`. Consumers:
- Guestbook: wall priority is now cloud → guestbookCsv → wall.json →
  SETTINGS. Pinning posts with optimistic insert and rollback on failure;
  the wall re-fetches on success and every 60s while the page is visible
  and the tab focused. The mailto button hides; photo compression rises
  to 1400px/q0.82 in cloud mode (Drive, not localStorage, absorbs it).
- Kiko Dash: `kdCloudSubmit()` posts on game over when the run beats the
  last submitted value (`km-kd-sent` in localStorage); `kdLiveBoard()`
  renders the top 10 (server aggregates best-per-name). The scoreCsv path
  only runs when the cloud is off.
- Songs: each add posts fire-and-forget with a toast either way.

All cloud failures degrade to v7 behaviour; an empty `cloudUrl` skips the
code paths entirely.

## Navigation rewrite

Mobile (≤1024px) is a fixed right-hand drawer (`nav.links`), animated by
transform, with a dimming `#nav-veil` and `body.nav-locked` scroll lock.
Two stacking traps solved: the veil sits at z-index 190, *below* the
header's stacking context (200), so the drawer inside the header paints
above it; and the header drops its `backdrop-filter` on mobile because a
backdrop-filtered ancestor becomes the containing block for
position:fixed descendants, which would have pinned the drawer to the
header. Groups are JS accordions (`.m-open`, max-height transition, one
open at a time). `navSet(open)` centralises open/close and is called from
the burger, the ×, the veil, Escape, and `show()` on every route change.

Desktop dropdowns animate via opacity/visibility/transform (not
display), opening on `:hover` and `:focus-within`. The stuck-menu bug
was `:focus-within` persisting after a click; two listeners fix it —
`mouseenter` on a group blurs a focused *other* group, `mouseleave`
blurs the group itself — leaving keyboard navigation intact.

## Kiko Dash 3 internals

- Delta-time loop: `dt = min(2.6, elapsed/16.667)`; all physics, timers
  and the score clock scale by dt, so 60Hz and 120Hz displays play
  identically. Spawning moved from `frame %` (breaks with fractional
  frames) to a `spawnIn` countdown with jitter.
- Canvas renders at `devicePixelRatio` (capped 2) against a fixed
  800×220 logical space; CSS `aspect-ratio:800/220` replaces the fixed
  height that used to squash phones. `touch-action:none` kills tap delay
  and scroll-jank.
- Input: `press()`/`release()` on pointerdown/up and Space/ArrowUp
  keydown/keyup (repeat-guarded). A press within 7 frames of landing is
  buffered and fires on touchdown; releasing early clamps `kvy` for a
  short hop.
- Levels: `enterLevel(lv)` every 100m — clears obstacles, sets
  `grace=110` frames and draws a fading on-canvas card. While grace > 0
  nothing spawns and collision is skipped.

## Polish layer

Reveal-on-scroll: an IntersectionObserver adds `.rev` then `.in` to
`.fun-card,.game-card,.wo-card,.acc,.fest-day,.board,.gb-form`. The class
is only ever added by JS and the whole block is skipped under
prefers-reduced-motion, so nothing can be stranded invisible. Header
gains `.scrolled` past 8px. Buttons/cards have transform
micro-transitions; the global reduced-motion kill-switch still nukes all
animation.

## Testing

Playwright (headless Chromium) at 1280, 390×844 and 844×390 across all
three tiers: gate, drawer open/close/veil/lock, accordion exclusivity,
route-change cleanup, dropdown stuck-menu regression, menu order, zero
horizontal overflow, canvas aspect, zero JS errors. Cloud path tested
end-to-end against a local mock of the Apps Script contract: pin with
photo, cross-context wall visibility, auto score submit, live tally
render, song post, and a no-input run surviving the grace window.
Scripts: `test_site.py`, `test_cloud.py` (need `python3 -m http.server`).

## Known debts (v8)

The guestbook's optimistic entry can briefly duplicate after the
confirming re-fetch on very slow connections (self-heals on next
refresh). The 60s wall poll is deliberate politeness to Apps Script
quotas, not a technical ceiling. Pre-cloud local pins still render with
their "on this device" badge alongside cloud entries.

---

# v9 developer notes

## Phone nav dropdown — the real fix

v8 tried to make the drawer submenus accordion-style but left the desktop
rule `.ngroup:hover>.nmenu{position:absolute;left:50%…}` applying on
touch: a tap fires `:hover`, so the submenu positioned absolutely and
overflowed the viewport (visible in the owner's screenshot). Fix:
`.nmenu` now defaults to the phone accordion (`max-height` transition,
`position:static`), and ALL desktop dropdown styling (absolute, hover,
fade) lives inside `@media (min-width:1025px)`. A phone never matches
that query, so `:hover` can't reposition anything. Also pinned drawer
flex children with `min-width:0;max-width:100%` so a wide submenu wraps
instead of forcing horizontal scroll in landscape (flex items default to
`min-width:auto`). Verified static/​below/​no-overflow at 390, 375, 844,
667 widths.

## RSVP system

**Data model.** New "RSVPs" tab, one row per household keyed by
`normKey_(leadName)` (lowercase, alnum-only). `saveRsvp_` upserts: scans
the key column, overwrites the matching row or appends. Columns break out
the queryable fields (attending, party_size, city, country, lat, lng,
per-event Yes/No, email, mobile) plus `guests_json` (array of
{name,child,diet[],dietOther}), `full_address` (private), and
`details_json` (spare). Address → lat/lng/city/country via
`Maps.newGeocoder()` (built-in Apps Script service, no key); best-effort,
RSVP still saves if geocoding fails. Reads: `readOneRsvp_(name)` returns
the latest row for a household as a typed object; `readAtlas_()` returns
one entry per household (latest wins), attending-only, geocoded-only,
city+country+coords — never the street.

**Client.** Config (`DIET_OPTS`, `RSVP_EVENTS`, `tierHasCatering`) and
`RSVP_STATE` are hoisted up near `TIER` so `dashRsvpRender` (called from
`dashRender` at load) doesn't hit the TDZ. `rsvpInit()` is lazy — called
by the router on first `#rsvp` visit, AFTER `applyTier` has set `TIER`,
so the event list and catering match the guest's tier. Single-event
tiers (vinko/afterparty) pre-tick and hide the "which celebrations"
fieldset. Guest rows rebuild on party-size change, preserving typed
values; guest 1's name mirrors the lead-name field until manually
edited. Submit posts `{action:"rsvp",…}`; success shows the summary
banner, updates the dashboard card, and calls `atlasCloudRefresh()`.
On load, `loadForName()` fetches the household's existing RSVP by gate
NAME and prefills + shows the saved banner. Matching is by gate name
(identity, not auth) — an intentional consequence of the shared-password
tier model; the form asks guests to keep the name consistent.

**Guest Atlas.** `MAPS.atlas` config plus `atlasCloudRefresh()` →
`cloudGet("atlas")` → `atlasRenderRows()`. Distance via haversine to
`ST_ALBANS`. Crucially the leaderboard renders even when Leaflet fails to
load (offline / blocked CDN): `initMapFor` now calls `atlasCloudRefresh`
in the `typeof L === "undefined"` branch too, and `atlasRenderRows`
guards pin-dropping with `if(atlasMap && atlasDrop)`. Re-pulls on every
atlas visit so new RSVPs appear without reload.

**Removed.** `SETTINGS.rsvpLinks` and the `.rsvp-full/.rsvp-vinko/
.rsvp-afterparty` wiring in `applyTier` (the inline form replaces them).
`guestMapCsv` slot retained but unused.

## Spotify

`SETTINGS.sharedPlaylist` set to the playlist URL; existing
`spotifyEmbed()` extracts the ID and builds the `/embed/playlist/<id>`
iframe (352px, matches Spotify's own embed). No new code.

## Cloud contract additions

GET `?action=rsvp&name=…` → one household object | null.
GET `?action=atlas` → array of {name,city,country,lat,lng,attending}.
POST `{action:"rsvp",…}` → "saved" | "updated". `cloudGet` gained an
optional `params` object for the `name` query param.

## Testing

`test_rsvp.py` — mock Apps Script mirroring the RSVP/atlas contract
(incl. a stub geocoder): full-tier submit with 2 guests + child + diet +
other + events + geocode; remember-on-relogin; dashboard render; edit
with prefill; atlas leaderboard (furthest-first, declined excluded,
haversine miles, map-less path); afterparty excludes catering; vinko is
pre-wedding-only with catering. All pass, zero page errors. `test_site.py`
and `test_cloud.py` still green (nav/games/guestbook/scores/songs).

---

# v10 — production code review fixes

A pull-request-style review of v9 found and fixed the following.

## Critical

**Sheets formula injection (Code.gs).** All guest text was written to the
spreadsheet via appendRow/setValues, and Sheets executes cell values
beginning with `=` `+` `-` `@` as formulas — `=IMPORTXML(...)` in a
guestbook note would run inside the couple's sheet on open and could
exfiltrate its contents. `clean_()` now prefixes an apostrophe to any
value starting with those characters (or tab/CR); Sheets stores it as
literal text and `getValues()` returns it apostrophe-free, so the
website is unaffected.

**Cyrillic household-key collision (Code.gs).** `normKey_` stripped
everything outside `[a-z0-9]`, so every guest with a fully non-Latin
name (e.g. "Олена Шевченко") keyed to the empty string — all such
households would silently overwrite one another's RSVPs. Now
`[^\p{L}\p{N}]+/gu` (any Unicode letter/digit), with a lowercase-trim
fallback if a name contains no letters at all. Note: keys are computed
at save time, so any test rows saved under v9 with non-Latin names
should be deleted before launch.

## Medium

- The concierge's local regex-escaper was named `esc`, shadowing the
  global HTML-escaping `esc()` — a future edit could grab the wrong one
  and open an XSS hole. Renamed `rxEsc`, with a comment.
- The RSVP prefill used a function-reassignment hack
  (`readGuestRows = function(){ return RSVP_PREFILL || ... }`).
  Replaced with an explicit `buildGuestRows(prefill)` parameter; the
  size-change listener wraps the call so the Event object can't be
  mistaken for prefill data.
- Removed dead code (`window.__rsvpReloadForName`).
- RSVP validation: every party member must have a name; provided emails
  must look like emails. Friendly inline errors.
- Guestbook photo files in Drive are now named by their real image type
  instead of always `.jpg`.

## Hardening / accessibility

- `esc()` now also escapes `'` and `>`, making it safe in every HTML
  context a future editor might use it in (comment added saying so).
- Guestbook wall images only render from `https://`, `images/`, or
  `data:image/` — the cloud path was already server-controlled, but the
  legacy CSV fallback wasn't scheme-checked.
- The RSVP accept/decline toggle now maintains `aria-pressed`, so
  screen readers announce the selection (kept in sync on prefill too).

## Reviewed and intentionally unchanged

- All user-content renderers (guestbook, concierge, songs, both
  leaderboards, Top Trumps) already use `textContent` — no XSS found.
- Guestbook `type` is whitelisted server-side; className injection via
  the CSV fallback is inert.
- `cloudKey` remains deterrence, not security (documented since v8);
  the moderated sheet is the trust boundary.
- The optimistic-pin transient duplicate self-heals on refresh
  (documented v8 debt).
- Kiko grace-check test flake under CI load was a harness calibration
  issue, not a product bug — the check now polls instead of sleeping.

---

# V11 update — structure, Connie, guestbook mosaic

A large content + feature pass. Summary of what changed and why, so a
future editor isn't surprised.

## Global
- **Image naming flattened.** Every `images/x.jpg` is now `images_x.jpg`
  (Netlify serves flat files more reliably than slash-pathed ones). The
  guestbook image whitelist accepts both `images/` and `images_` so any
  legacy `wall.json`/CSV entries still render. See `PHOTO-CHECKLIST.md`
  for the full list of expected files.

## Home
- Hero date is now a prominent "Saturday · 29th May 2027" lockup.
- Countdown restyled as one framed panel (CSS only; the "sleeps" click
  easter egg is unchanged).

## Our Story
- **Story map:** the hand-drawn SVG map, its legend and the percent-based
  pin board were removed (HTML + CSS + JS). Replaced by one Leaflet map
  driven by `SETTINGS.storyMap` (place, lat, lng, cat, note, optional img).
  Categories: from / home / travel / hm, colour-keyed. Arcs auto-drawn
  from each `from` pin to the `home` pin. Popups show an optional photo
  (flat `images_story-*.jpg` names, scheme-checked, self-removing on 404).
  The hunt petal (`data-hunt="2"`) moved into the new legend.
- **Bios:** the three "five facts" cards became Megan/Kazimir/Kiko
  `<details>` accordions with baby/now photo slots that self-remove if the
  file is missing.
- **Thank Yous:** new page `#page-thankyous` (SHARED tier), added to nav
  and the SHARED route list.

## Celebrations
- **Wedding Week:** a compact classical calendar added at the top; each day
  cell scrolls to a `#day-NN` anchor on the detailed cards below.
- **Big Day:** emoji timeline replaced with fest-styled titled entries that
  carry a time in the medal. Bus easter egg preserved as a text-link span.
- **Ceremony:** renamed (breakfast content removed; now Cathedral-only).
- **Reception split:** new `#page-breakfast` (Wedding Breakfast, `full`
  only) and `#page-reception` (Evening Reception, now `full afterparty`).
  ACCESS map + nav updated so after-party guests see the evening reception
  and after party but NOT the wedding breakfast.

## Explore
- **London:** pins recategorised to match the "Choose your adventure"
  options and colour-keyed; a legend sits under the map. Added "Getting to
  London" and "Getting around London" with official TfL links (tube PDF,
  bus, cycle, Legible London walking, TfL hub).
- **Europe:** each card shows a rough budget-airline return-fare estimate
  for early June next to its travel time, with a caveat note.

## For Guests
- **RSVP:** an `afterparty` event added to every tier's `RSVP_EVENTS`
  (all tiers can now opt in). Requires the matching Code.gs column (below).
- **Guest Dashboard removed:** page, nav link and route deleted.
  `dashRender()` is now a no-op and `dashRsvpRender()` guards on a missing
  element, so RSVP still works. `GUESTS_LIVE` load retained for RSVP
  name-matching. Concierge "dashboard" answer repointed to seating/RSVP.
- **Guest Atlas:** unchanged — the "Furthest travelled" leaderboard already
  renders below the map (and survives a blocked Leaflet CDN).
- **Kiko Dash:** scene interval changed from every 100m to every 250m
  (`levelFor` divides by 250; on-page copy updated).

## Keepsakes — Guestbook (biggest change)
- Two genuinely separate walls, **Before** and **After**, each with a notes
  strip (memory/advice/wish cards) AND a **living photo mosaic**: square
  lazy-loaded thumbnails that enlarge on hover/tap, opening a shared
  **lightbox** (arrow keys / on-screen arrows / Esc).
- Uploads support **multiple photos at once**; each becomes a mosaic tile.
  Photo-only entries (no text) are allowed. A pin lands on whichever wall's
  tab is active (`gbActive`).
- Photo batches render 60 at a time per wall (`gbShown` is now
  `{before, after}`), so ~1000 photos never build a monstrous page.
- Entries carry a `phase` ("before"/"after"); legacy rows default to
  "before".

## Connie — the concierge
- Renamed throughout to **Connie** (Concierge for Nuptials, Networking,
  Itineraries & Events): FAB, panel header, nudge, greeting, aria-labels.
- KB expanded from ~35 to ~55 entries covering the whole current site
  (ceremony/breakfast/reception split, Hatfield, thank-yous, story/map,
  Kiko, dietary, accessibility, health, Ukrainian traditions, London
  travel + TfL, Europe fares, after-party RSVP, the mosaic guestbook,
  and a menu-navigator).
- Engine upgraded: a `SYN` synonym map widens matching, phrase keywords
  score higher, and the fallback names concrete topics instead of dead-ending.

## Code.gs
- Guestbook: new `phase` column (before/after) in headers, write row and
  read mapping; photo-only entries now allowed (empty text is fine if an
  image is present); `type` whitelist gained `"photo"`.
- RSVP: new `afterparty` column added to `RSVP_HEADERS`, the saved row and
  the read-back object (21 headers / 21 row cells — kept in sync).
- **Redeploy required** for these to take effect: Deploy → Manage
  deployments → edit → New version → Deploy. The web-app URL is unchanged,
  so the website needs no edit.
