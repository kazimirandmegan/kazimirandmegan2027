# Kazimir & Megan — Wedding Website

This is the website for **Kazimir & Megan’s wedding** on **29 May 2027** in **St Albans**.

This README is for people helping build or edit the site (you don’t need to be a developer to follow most of it). Wedding guests use the live site link and the password from their invitation — not this document. 

---

## Run it on your computer

### Easiest: double-click the launcher

Pick the file that matches your computer and open it (double-click):

| Your computer | Open this file |
|---------------|----------------|
| **Windows** | [`Start Wedding Site.bat`](Start%20Wedding%20Site.bat) |
| **Mac** | [`Start Wedding Site.command`](Start%20Wedding%20Site.command) |
| **Linux** | [`Start Wedding Site.sh`](Start%20Wedding%20Site.sh) |

**Mac tip:** the first time, Finder may block it. Right-click the file → **Open** → confirm **Open**. After that, double-click works normally.

A terminal window opens and does the rest for you. The first run can take a few minutes.

#### What it does

1. Checks for Node.js (downloads a private copy into `.tools/` if you don’t have it)
2. Installs the project packages (`npm install`)
3. Starts the website on your computer
4. Opens a **Cloudflare Tunnel** so the same site gets a public HTTPS link you can use on your phone or any other device
5. Tries to open that link in your browser

When it’s ready you’ll see two addresses:

- **This computer** — something like `http://127.0.0.1:5173` (only works on the machine that’s running the launcher)
- **Phone / any device** — something like `https://….trycloudflare.com` (works anywhere with internet)

The public link is also saved in [`.tools/public-url.txt`](.tools/public-url.txt) while the launcher is running.

#### While it’s running

- **Leave the window open** — closing it (or pressing `Ctrl+C`) stops the site and the public link.
- The Cloudflare link **changes every time** you start the launcher.
- You still need an invitation password to get past the gate (any name works; capitals and spaces in the password don’t matter):

| Guest access | Password | Who it’s for |
|--------------|----------|--------------|
| **full** | `hydrangea2027` | Invited to everything |
| **vinko** | `barvinok2027` | Pre-wedding celebration |
| **afterparty** | `budmo2am` | Evening / after party |

  These are also listed under **Guest access levels** below, and live in [`src/config/settings.js`](src/config/settings.js) if you need to change them.
- You need an internet connection for the public Cloudflare link. The local address works offline once packages are installed.
- This is for **testing**, not the final wedding website. For the real hosted site, see **Publishing the site** below.

From a terminal in this folder you can do the same thing with:

```bash
npm start
```

### Manual start (developers only)

If you already have [Node.js](https://nodejs.org/) 18+ and only want the site on this computer (no public link):

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

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

- **`Start Wedding Site.*`** — double-click launchers (Windows / Mac / Linux) that start the site and a Cloudflare test link
- **`scripts/`** — the automatic setup behind those launchers
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

There are **three passwords**, each unlocking a different version of the site.
Capitals and spaces don’t matter when typing them.

| Level | Password | Who it’s for | What they see |
|-------|----------|--------------|---------------|
| **full** | `hydrangea2027` | Guests invited to the whole celebration | Everything |
| **vinko** | `barvinok2027` | Guests invited to the pre-wedding celebration | Shared pages + the Vinko page |
| **afterparty** | `budmo2am` | Evening / late guests | Shared pages + reception + after party |

Shared pages include Home, About, Stay, RSVP, Explore, Games, Guestbook, and similar. Celebration pages (ceremony, breakfast, full week, and so on) are limited by invitation.

To change a password later, edit [`src/config/settings.js`](src/config/settings.js). This is front-door privacy only — it is not hard security.

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
