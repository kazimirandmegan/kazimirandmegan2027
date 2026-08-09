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
    { place: "St Louis, MO", lat: 38.6270, lng: -90.1994, cat: "from",
      note: "Where Megan grew up", img: "images_story-stlouis.jpg" },
    { place: "St Albans, England", lat: 51.7527, lng: -0.3394, cat: "home",
      note: "Where Kazimir grew up — and home", img: "images_story-stalbans.jpg" },
    { place: "Columbia, SC", lat: 34.0007, lng: -81.0348, cat: "from",
      note: "Where Megan went to uni and worked for two years", img: "" },
    { place: "Cambridge, England", lat: 52.2053, lng: 0.1218, cat: "from",
      note: "Where Kazimir and Megan went to uni and met", img: "" },
    { place: "Edmonton, Canada", lat: 53.5461, lng: -113.4938, cat: "from",
      note: "Where Kazimir spent summers with his Canadian grandparents and cousins", img: "" },
    { place: "Provincetown, Cape Cod, MA", lat: 42.0501, lng: -70.1853, cat: "travel",
      note: "Where Kazimir and Megan got engaged (and also where the British first landed in America)", img: "" },
    { place: "Klagenfurt, Austria", lat: 46.6228, lng: 14.3050, cat: "travel",
      note: "Kazimir's first surprise trip for Megan", img: "" },
    { place: "Madeira, Portugal", lat: 32.7607, lng: -16.9595, cat: "travel",
      note: "Megan's first surprise trip for Kazimir", img: "" },
    { place: "Dolomiti, Italy", lat: 46.4102, lng: 11.8440, cat: "travel",
      note: "Kazimir's second surprise trip for Megan", img: "" },
    { place: "Costa Brava, Spain", lat: 41.8333, lng: 3.0000, cat: "travel",
      note: "Megan's second surprise trip for Kazimir", img: "" },
    { place: "Paris, France", lat: 48.8566, lng: 2.3522, cat: "travel",
      note: "Several trips together where we felt like main characters", img: "" },
    { place: "Porto, Portugal", lat: 41.1579, lng: -8.6291, cat: "travel",
      note: "The start of Megan's Camino de Santiago pilgrimage, where Kazimir dropped her off", img: "images_story-camino.jpg" },
    { place: "Istanbul, Turkey", lat: 41.0082, lng: 28.9784, cat: "travel",
      note: "We went back after our Antalya trip because we LOVE Turkey", img: "" },
    { place: "Antalya, Turkey", lat: 36.8969, lng: 30.7133, cat: "travel",
      note: "The first Uzwyshyn-Jones family trip that Megan joined", img: "" },
    { place: "Tbilisi, Georgia", lat: 41.6938, lng: 44.8015, cat: "travel",
      note: "Family trip for Constance's 60th birthday", img: "" },
    { place: "Durham, England", lat: 54.7753, lng: -1.5849, cat: "travel",
      note: "Visiting Kazimir's grandmother, Baba Ro", img: "" },
    { place: "Weymouth, England", lat: 50.6151, lng: -2.4575, cat: "travel",
      note: "Visiting Kazimir's brother Maksym", img: "" },
    { place: "Liverpool, England", lat: 53.4084, lng: -2.9916, cat: "travel",
      note: "Visiting Kazimir's cousin Angus", img: "" },
    { place: "Chester, England", lat: 53.1905, lng: -2.8910, cat: "travel",
      note: "Visiting Kazimir's Aunt Nina and Uncle Dan", img: "" }
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
