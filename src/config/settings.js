/* ================== SETTINGS — EDIT ME ==================
   Everyday site config: passwords, dates, emails, playlists,
   cloud link, and seed content. Change text between quotes.
   ============================================================ */
export const SETTINGS = {
  /* THREE passwords, one per guest tier. Case doesn't matter. */
  passwords: {
    full:       "hydrangea2027",   /* invited to everything      */
    vinko:      "barvinok2027"     /* pre-wedding celebration     */
  },

  /* Countdown target: year, month (5 = May), day, hour, minute */
  weddingDate: { year: 2027, month: 5, day: 29, hour: 12, minute: 0 },

  contactEmail: "kazimirandmegan@gmail.com",
  whatsappLink: "https://chat.whatsapp.com/Irn1evSuMajKAOUxzqUb3G?mode=gi_t",
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

  /* Shared photo albums — one per section. Google Photos shared album
     links work beautifully. "" shows a coming-soon note.              */
  photoAlbums: {
    weddingWeek:  "",   /* Wedding Week photos  */
    vinkopletyny: "",   /* Vinkopletyny photos  */
    ceremony:     "",   /* Ceremony photos      */
    reception:    ""    /* Reception photos     */
  },

  /* ---- Our story map ✏️ EDIT: one real map on the About Us page.
     cat: "from" (gold — important places) |
          "travel" (periwinkle — travelled together) | "hm" (honeymoon).
     Coordinates: right-click any spot on Google Maps and copy the two
     numbers. Photos are optional — save one as e.g. images_story-paris.jpg
     (flat names, no folders) and put that name in img. Pins without a
     photo still work; the picture appears in the pin's popup when added. ---- */
  storyMap: [
    /* ---- Important places (gold pins) ---- */
    { place: "St Louis, MO", lat: 38.6270, lng: -90.1994, cat: "from",
      note: "Where Megan was born/grew up", img: "images_story-stlouis.jpg" },
    { place: "Liverpool, England", lat: 53.4084, lng: -2.9916, cat: "from",
      note: "Where Kazimir was born", img: "images_story-liverpool.jpg" },
    { place: "Kyiv, Ukraine", lat: 50.4501, lng: 30.5234, cat: "from",
      note: "Where Kazimir spent first few years", img: "images_story-kyiv.png" },
    { place: "St Albans, England", lat: 51.7527, lng: -0.3394, cat: "from",
      note: "Where Kazimir grew up", img: "images_story-stalbans.jpg" },
    { place: "Cambridge, England", lat: 52.2053, lng: 0.1218, cat: "from",
      note: "Where Kazimir & Megan went to Uni and met", img: "images_story-cambridge.jpg" },
    { place: "London, England", lat: 51.5074, lng: -0.1278, cat: "from",
      note: "Where Kazimir & Megan lived and worked", img: "images_story-london.jpg" },
    { place: "Columbia, SC", lat: 34.0007, lng: -81.0348, cat: "from",
      note: "Where Megan went to uni and worked for two years", img: "images_story-columbia.jpg" },
    { place: "Edmonton, Canada", lat: 53.5461, lng: -113.4938, cat: "from",
      note: "Where Kazimir spent summers with his Canadian grandparents and cousins", img: "images_story-edmonton.jpg" },
    { place: "Cape Cod, MA", lat: 42.0501, lng: -70.1853, cat: "from",
      note: "We got engaged (Kazimir proposed to Megan)", img: "images_story-capecod.jpg" },
    { place: "Henley-on-Thames, England", lat: 51.5368, lng: -0.9006, cat: "from",
      note: "Megan proposed to Kazimir", img: "images_story-henley.jpg" },

    /* ---- Travelled together (periwinkle pins) ---- */
    { place: "Klagenfurt, Austria", lat: 46.6228, lng: 14.3050, cat: "travel",
      note: "Kazimir's first surprise trip for Megan", img: "images_story-klagenfurt.jpg" },
    { place: "Madeira, Portugal", lat: 32.7607, lng: -16.9595, cat: "travel",
      note: "Megan's first surprise trip for Kazimir", img: "images_story-madeira.jpg" },
    { place: "Dolomiti, Italy", lat: 46.4102, lng: 11.8440, cat: "travel",
      note: "Kazimir's second surprise trip for Megan", img: "images_story-dolomiti.jpg" },
    { place: "Costa Brava, Spain", lat: 41.8333, lng: 3.0000, cat: "travel",
      note: "Megan's second surprise trip for Kazimir", img: "images_story-costabrava.jpg" },
    { place: "Paris, France", lat: 48.8566, lng: 2.3522, cat: "travel",
      note: "Several trips together where we felt like main characters", img: "images_story-paris.jpg" },
    { place: "Porto, Portugal", lat: 41.1579, lng: -8.6291, cat: "travel",
      note: "The start of Megan's Camino de Santiago pilgrimage, where Kazimir dropped her off", img: "images_story-porto.jpg" },
    { place: "Istanbul, Turkey", lat: 41.0082, lng: 28.9784, cat: "travel",
      note: "We went back after our Antalya trip because we LOVE Turkey", img: "images_story-istanbul.jpg" },
    { place: "Antalya, Turkey", lat: 36.8969, lng: 30.7133, cat: "travel",
      note: "The first Uzwyshyn-Jones family trip that Megan joined", img: "images_story-antalya.jpg" },
    { place: "Tbilisi, Georgia", lat: 41.6938, lng: 44.8015, cat: "travel",
      note: "Family trip for Constance's 60th birthday", img: "images_story-tbilisi.jpg" },
    { place: "Durham, England", lat: 54.7753, lng: -1.5849, cat: "travel",
      note: "Visiting Kazimir's grandmother, Baba Ro", img: "images_story-durham.jpg" },
    { place: "Weymouth, England", lat: 50.6151, lng: -2.4575, cat: "travel",
      note: "Visiting Kazimir's brother Maksym", img: "images_story-weymouth.jpg" },
    { place: "Chester, England", lat: 53.1905, lng: -2.8910, cat: "travel",
      note: "Visiting Kazimir's Aunt Nina and Uncle Dan", img: "images_story-chester.jpg" },
    { place: "Bristol, England", lat: 51.4545, lng: -2.5879, cat: "travel",
      note: "Visiting Zoryana", img: "images_story-bristol.jpg" },
    { place: "Oxford, England", lat: 51.7520, lng: -1.2577, cat: "travel",
      note: "Following the path of a severe mercy", img: "images_story-oxford.jpg" },
    { place: "Canterbury, England", lat: 51.2802, lng: 1.0789, cat: "travel",
      note: "Quaint English daytrip", img: "images_story-canterbury.jpg" },
    { place: "Newcastle, England", lat: 54.9783, lng: -1.6178, cat: "travel",
      note: "Visiting Maksym & Georgia", img: "images_story-newcastle.jpg" },
    { place: "Brussels, Belgium", lat: 50.8503, lng: 4.3517, cat: "travel",
      note: "Weekend trip with Moules-frites", img: "images_story-brussels.jpg" },
    { place: "Rome, Italy", lat: 41.9028, lng: 12.4964, cat: "travel",
      note: "Endless sculptures & ice cream", img: "images_story-rome.jpg" },
    { place: "Zadar, Croatia", lat: 44.1194, lng: 15.2314, cat: "travel",
      note: "Weekend trip with black squid ink risotto", img: "images_story-zadar.png" },
    { place: "Hoedspruit, South Africa", lat: -24.3619, lng: 30.9571, cat: "travel",
      note: "Safari with R&C", img: "images_story-southafrica.jpg" },
    { place: "Dataw Island, SC", lat: 32.4163, lng: -80.4710, cat: "travel",
      note: "Met up with the Molassos (Megan's family friend)", img: "images_story-dataw.jpg" },
    { place: "New York City, NY", lat: 40.7128, lng: -74.0060, cat: "travel",
      note: "Sri & Anna are the best hosts", img: "images_story-nyc.jpg" },
    { place: "Raleigh, NC", lat: 35.7796, lng: -78.6382, cat: "travel",
      note: "Engagement party with Megan's family & Zoryana", img: "images_story-raleigh.jpg" },
    { place: "Helsinki, Finland", lat: 60.1699, lng: 24.9384, cat: "travel",
      note: "Ice hole sauna", img: "images_story-helsinki.jpg" },
    { place: "Tallinn, Estonia", lat: 59.4370, lng: 24.7536, cat: "travel",
      note: "Euro trip within euro trip", img: "images_story-tallinn.jpg" }
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
  playlists: [
    { title: "Everyone please add your favourite songs on here for a master joint wedding playlist", url: "https://open.spotify.com/playlist/79yMK2iGComznorUWp5i56" }
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
  cloudUrl: "https://script.google.com/macros/s/AKfycbwPCmTWoI4DEdhYcrwAGTCJ-lEzZMfpgwYVVfRHX4ZJHd45U4E-N2KYtgE7UbkDeJie9Q/exec",
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
  guestMapCsv:     "",  /* Guest Atlas pins — name,place,lat,lng        */

  googleCalendarUrl: "https://calendar.google.com/calendar/ical/eccd8f4109e6569d58de955f799ca83e461628dd907e86d9ee03e4e8a23da091%40group.calendar.google.com/public/basic.ics"  /* Google Calendar subscribe link — set to enable the button in Wedding Week */
};
