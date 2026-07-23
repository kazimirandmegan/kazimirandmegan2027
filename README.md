# Kazimir & Megan — Wedding Website

This is the website for **Kazimir & Megan’s wedding** on **29 May 2027** in **St Albans**.

This README is for people helping build or edit the site (you don’t need to be a developer to follow most of it). Wedding guests use the live site link and the password from their invitation — not this document.

---

## Run it on your computer

You need [Node.js](https://nodejs.org/) installed (version 18 or newer is fine).

1. Open a terminal in this project folder.
2. Install dependencies (only needed the first time, or after dependencies change):

```bash
npm install
```

3. Start the local site:

```bash
npm run dev
```

4. Open the address Vite prints (usually `http://localhost:5173`).
5. Sign in at the gate with your name and a guest password. The three passwords live in [`src/config/settings.js`](src/config/settings.js) — look for `passwords` near the top. (We don’t list them here on purpose.)

To stop the local server, press `Ctrl+C` in the terminal.

---

## Where to change everyday content

| What you want to change | Where to look |
|-------------------------|---------------|
| Passwords, wedding date, email, WhatsApp, playlists, cloud link, seed guestbook entries | [`src/config/settings.js`](src/config/settings.js) |
| Wording on a specific page | The matching file under [`src/pages/`](src/pages/) |
| Photos | Drop files into [`public/`](public/) using the names in [`docs/PHOTO-CHECKLIST.md`](docs/PHOTO-CHECKLIST.md) |
| Bridal party Top Trumps stats | [`src/data/party.js`](src/data/party.js) |
| Connie’s answers (the chat helper) | [`src/data/concierge-kb.js`](src/data/concierge-kb.js) |
| Quiz / crossword / hunt riddles | [`src/data/quiz.js`](src/data/quiz.js), [`src/data/crossword.js`](src/data/crossword.js), [`src/data/hunt.js`](src/data/hunt.js) |
| Explore map pins | [`src/data/maps/`](src/data/maps/) |

Search the project for `PLACEHOLDER` to find details that still need filling in.

---

## How the project is organised

- **`src/pages/`** — each page of the site (Home, RSVP, Ceremony, and so on)
- **`src/config/`** — settings you edit often (passwords, links, dates)
- **`src/css/`** — look and feel (colours, layout, components)
- **`src/js/`** — how the site behaves (gate, navigation, RSVP, games, …)
- **`src/data/`** — lists and content used by games, maps, and Connie
- **`public/`** — photos and other files copied as-is when you publish
- **`backend/`** — optional Google Apps Script for live guestbook, RSVPs, and scores
- **`docs/`** — longer technical notes and the photo checklist

---

## Pages

Guests move between pages with the menu (and `#` links). Some pages only appear for certain invitation types (see **Guest access levels** below).

| Page | What it’s for |
|------|----------------|
| **Home** | Welcome, countdown, weather snippet, calendar download, note to guests |
| **About Us** | Your story, journey map, short bios |
| **The Bridal Party** | Top Trumps-style cards for the wedding party |
| **Generations of Love** | Family wedding photos through the years |
| **In Loving Memory** | A quiet space for those who can’t be with us |
| **Behind the Scenes** | Planning polaroids and peeks behind the curtain |
| **Thank Yous** | Credits for makers, hosts, and helpers |
| **The Wedding Week** | Day-by-day calendar for the week of the wedding |
| **Pre-Wedding Celebration (Vinko)** | The Ukrainian celebration before the big day |
| **The Big Day** | Saturday timeline hour by hour |
| **The Ceremony** | St Albans Cathedral — timings and background |
| **The Wedding Breakfast** | Meal at Hatfield House |
| **The Evening Reception** | Band, dancing, evening details |
| **The After Party** | Late pubs, trains, survival notes |
| **Where to Stay** | Hotels, Airbnb notes, buddy-board matchmaking |
| **RSVP** | Reply form (events depend on invitation type) |
| **Registry** | Gift / registry links |
| **Guestbook & Photos** | Wishes and photos before and after the day |
| **Playlists** | Spotify embeds and song requests |
| **In-Flight Entertainment** | Games: Kiko Dash, crossword, quiz, petal hunt |
| **St Albans** | Local field guide + map |
| **London** | London tips + map |
| **England Day Trips** | Day-trip ideas + map |
| **Europe** | Longer trips / Eurostar ideas + map |
| **For Americans** | US survival guide, weather, phrasebook, Patriot Mode |
| **Wedding Workouts** | Light fitness ideas for the week |
| **The Guest Atlas** | Map of where guests are travelling from |
| **FAQs** | Common questions |
| **Contact** | Email, WhatsApp, announcements |

---

## Shared pieces (not full pages)

| Piece | What it does |
|-------|----------------|
| **Password gate** | Asks for name + password before the site opens |
| **Navigation** | Desktop menus and the mobile drawer |
| **Connie** | Chat helper for trains, dress codes, timings, and more |
| **Maps** | Interactive Leaflet maps on story / explore / atlas pages |
| **Weather** | Live St Albans forecast (Open-Meteo) |
| **Countdown** | Days-until-the-wedding on the home page |
| **Guestbook wall** | Pins and the photo mosaic (can sync via the cloud backend) |
| **Top Trumps** | Bridal party cards with stats |
| **Games** | Runner game, crossword, quiz, easter-egg hunt |
| **Easter eggs** | Wax seal, paw, runaway bus, and a few other surprises |

---

## Guest access levels

There are **three passwords**, each unlocking a different version of the site:

| Level | Who it’s for | What they see |
|-------|----------------|---------------|
| **full** | Guests invited to the whole celebration | Everything |
| **vinko** | Guests invited to the pre-wedding celebration | Shared pages + the Vinko page |
| **afterparty** | Evening / late guests | Shared pages + reception + after party |

Shared pages include Home, About, Stay, RSVP, Explore, Games, Guestbook, and similar. Celebration pages (ceremony, breakfast, full week, and so on) are limited by invitation.

Passwords are in [`src/config/settings.js`](src/config/settings.js). This is front-door privacy only — it is not hard security.

---

## Publishing the site

1. Put any photos in `public/` (see the photo checklist).
2. Build the site:

```bash
npm run build
```

3. Deploy the **`dist/`** folder to Netlify (drag-and-drop, or connect the GitHub repo with publish directory `dist` — see `netlify.toml`).

Optional: to make guestbook pins, RSVPs, and game scores live for everyone, use the Google Apps Script in [`backend/Code.gs`](backend/Code.gs) and paste the web app URL into `SETTINGS.cloudUrl`. Details are in the developer notes.

---

## Going deeper

- [`docs/DEVELOPER-NOTES.md`](docs/DEVELOPER-NOTES.md) — architecture, cloud setup, testing notes  
- [`docs/PHOTO-CHECKLIST.md`](docs/PHOTO-CHECKLIST.md) — exact photo filenames the site expects  
- [`backend/Code.gs`](backend/Code.gs) — optional live backend (Sheets + Drive)
