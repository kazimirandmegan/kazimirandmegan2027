/* ================== SETTINGS — EDIT ME ==================
   Everyday site config: passwords, dates, emails, playlists,
   cloud link, and seed content. Change text between quotes.
   ============================================================ */
export const SETTINGS = {
  /* THREE passwords, one per guest tier. Case doesn't matter. */
  passwords: {
    full:       "hydrangea2027",   /* invited to everything      */
    vinko:      "barvinok2027",    /* pre-wedding celebration     */
    afterparty: "budmo2am"         /* after-party guests         */
  },

  /* Countdown target: year, month (5 = May), day, hour, minute */
  weddingDate: { year: 2027, month: 5, day: 29, hour: 12, minute: 0 },

  contactEmail: "PLACEHOLDER-email@example.com",
  whatsappLink: "#PLACEHOLDER-WHATSAPP-GROUP-LINK",
  spotifyLink:  "",                    /* "" hides the playlist card */
  vyshyvankaCode: "[PLACEHOLDER CODE]",

  /* ---- Guest personalisation ✏️ EDIT: one entry per household.
     Guests now sign in at the front door with their NAME plus one of the
     three tier passwords above; the name personalises the site and, if it
     matches an entry here, fills their dashboard. No per-guest passwords.
     LATER: point guestSheetCsv at a published Google Sheet and this list
     is fetched live instead (see DEVELOPER-NOTES.md). ---- */
  guests: [
    { name: "Test Guest", rsvp: "Confirmed ✔", table: "[Table TBD]",
      note: "Hello! This is your personal corner of the website. We'll drop seating, timings and little notes for you here as the day approaches. — K & M" },
    { name: "Megan", rsvp: "The bride. We assume yes.", table: "Top table, obviously",
      note: "Hi, us. Everything is going to be wonderful." }
  ],
  /* Published-to-web Google Sheet CSV link ("" = use the list above).
     Sheet columns, with a header row: name,rsvp,table,note            */
  guestSheetCsv: "",

  /* Shared photo album for after the wedding (Google Photos shared
     album link works beautifully). "" shows a coming-soon note.       */
  photoAlbum: "",

  /* ---- Our story map ✏️ EDIT: one real map on the About Us page.
     cat: "from" (gold — where we're from) | "home" (St Albans) |
          "travel" (periwinkle — places we've been) | "hm" (honeymoon).
     Coordinates: right-click any spot on Google Maps and copy the two
     numbers. Photos are optional — save one as e.g. images_story-paris.jpg
     (flat names, no folders) and put that name in img. Pins without a
     photo still work; the picture appears in the pin's popup when added. ---- */
  storyMap: [
    { place: "St Louis, USA", lat: 38.6270, lng: -90.1994, cat: "from",
      note: "Where Megan grew up", img: "images_story-stlouis.jpg" },
    { place: "[PLACEHOLDER: Canada — e.g. Toronto]", lat: 43.6532, lng: -79.3832, cat: "from",
      note: "[PLACEHOLDER: Kazimir's Canadian chapter]", img: "" },
    { place: "[PLACEHOLDER: Ukraine — e.g. Kyiv]", lat: 50.4501, lng: 30.5234, cat: "from",
      note: "[PLACEHOLDER: where the story really starts]", img: "" },
    { place: "St Albans, England", lat: 51.7527, lng: -0.3394, cat: "home",
      note: "Home — where all the arrows point", img: "images_story-stalbans.jpg" },
    { place: "Camino de Santiago", lat: 42.8806, lng: -8.5449, cat: "travel",
      note: "500 miles on foot, May 2026 — feet since forgiven", img: "images_story-camino.jpg" },
    { place: "[PLACEHOLDER: a place you've travelled]", lat: 48.8566, lng: 2.3522, cat: "travel",
      note: "[PLACEHOLDER: a memory from that trip]", img: "" }
  ],

  /* ---- Buddy Board ✏️ EDIT: matchmaking notices you curate ---- */
  matchBoard: [
    { who: "Megan & Kazimir", offer: "How this works",
      text: "Travelling far? Local with a spare room, a car, or excellent pub opinions? Post below — we read everything and introduce people by email." },
    { who: "[PLACEHOLDER: name]", offer: "Local guide on offer",
      text: "[PLACEHOLDER: e.g. Happy to run a St Albans walking tour on the Friday morning]" }
  ],

  /* ---- Playlists ✏️ EDIT ---- */
  sharedPlaylist: "https://open.spotify.com/playlist/6KxPYGdkbWsgduZPrzRgj8",   /* collaborative Spotify playlist — guests add songs there */
  playlists: [          /* extra playlists to embed; leave url "" for a placeholder card */
    { title: "Getting-ready mood", url: "" },
    { title: "Golden hour at the palace", url: "" },
    { title: "Dance floor, no mercy", url: "" }
  ],

  /* ---- Guestbook wall ✏️ EDIT: paste entries guests email you and they
     appear for everyone. type: "memory" | "advice" | "wish".
     Optional img: "images_guestbook-1.jpg" ---- */
  guestbookWall: [
    { who: "Megan & Kazimir", type: "wish",
      text: "We built this wall for you. Pin a memory, a wish, or your finest piece of married-life advice — and email it to us to make it permanent." },
    { who: "[PLACEHOLDER: name]", type: "advice",
      text: "[PLACEHOLDER: the first piece of wisdom on the wall]" }
  ],

  supportLink: "#PLACEHOLDER-CHARITY-LINK",  /* your chosen Ukraine charity */

  /* ============ THE LIVE CLOUD (Google Apps Script) ✏️ ============
     ONE link makes the guestbook, photo wall, Kiko Dash leaderboard
     and song requests genuinely live for every guest at once:
     a guest pins a note or photo → it lands in YOUR Google Drive →
     every other guest sees it within moments. No Google Forms look,
     no email round-trips, no redeploying.
     Setup takes ~10 minutes: follow GOOGLE-DRIVE-SETUP.md, then
     paste the Web app URL (ends in /exec) below.
     While this is "" everything falls back to the older
     CSV/Form/mailto behaviour further down.                        */
  cloudUrl: "https://script.google.com/macros/s/AKfycbyaiiLcUevVD1JP1RG14OHWy1Kq55vekUrphuPe7eaL8EAajBuxhyGLh_L-4eM3I90Y4w/exec",
  cloudKey: "hydrangea",  /* must match SECRET_KEY at the top of Code.gs */

  /* ============ LIVE DATA via Google Sheets/Forms ✏️ =============
     The pattern (full recipe in DEVELOPER-NOTES.md):
       Google Form → responses Sheet → File → Share → Publish to
       web → CSV → paste that CSV link below. The site fetches it
       on every load, so new entries appear WITHOUT redeploying.
     Form links: paste the form's share URL; for score/song forms
     use a PRE-FILLED link and swap the values for {name} etc.   */
  guestbookCsv:    "",  /* live wall     — columns: who,type,text,img   */
  guestbookFormUrl:"",  /* guests submit wall entries here              */
  scoreCsv:        "",  /* live Kiko Dash leaderboard — name,score      */
  scoreFormUrl:    "",  /* pre-filled link containing {name} & {score}  */
  songFormUrl:     "",  /* pre-filled link containing {song} & {name}   */
  guestMapCsv:     ""   /* Guest Atlas pins — name,place,lat,lng        */
};
