# Photo Checklist — every image the website looks for

This is the master list of photo files the site expects. Drop the matching
files into the **`public/`** folder (next to where `images_*.jpg` names are
referenced) before you build and redeploy to Netlify, and the pictures appear
automatically. Any file that isn't there simply stays hidden — nothing breaks,
so you can add photos in batches over time.
## The two golden rules

1. **Flat names, no folders.** Every filename starts with `images_` and has
   **no slash** in it. Netlify has trouble serving files that live in a
   sub-folder referenced with a `/`, so we renamed everything to a flat style:

   - ✅ `images_generations-5.jpg`   (correct — one flat file)
   - ❌ `images/generations-5.jpg`   (wrong — the `/` makes a folder Netlify may not find)

   When you export a big batch, just name them `images_generations-1.jpg`,
   `images_generations-2.jpg`, and so on, and upload them all at once.

2. **Match the name exactly.** Lower-case, hyphens (not spaces or underscores
   inside the descriptive part), `.jpg` at the end. `images_Megan-Now.JPG`
   will *not* match `images_megan-now.jpg`.

**Format:** JPEG (`.jpg`) is best for photos. Keep each file under ~2–3 MB —
large photos slow the page down. Roughly 1600px on the long edge is plenty.

---

## The list, page by page

Tick these off as you upload. "Shape" is only a suggestion for how the photo
is framed on the page — any photo works, it'll just be cropped to fit.

### Home & headers
- [ ] `images_home.jpg` — the big hero photo on the landing page *(wide/landscape)*
- [ ] `images_about.jpg` — header photo on the About Us page *(wide)*
- [ ] `images_cathedral.jpg` — St Albans Cathedral, on the Ceremony page *(wide)*
- [ ] `images_hatfield.jpg` — Hatfield House, on the Evening Reception page *(wide)*

### Our Story → About Us
The two of you. Baby photos are a lovely touch here.
- [ ] `images_megan-baby.jpg` — Megan as a baby *(portrait, 4:5)*
- [ ] `images_megan-now.jpg` — Megan now *(portrait, 4:5)*
- [ ] `images_kazimir-baby.jpg` — Kazimir as a baby *(portrait, 4:5)*
- [ ] `images_kazimir-now.jpg` — Kazimir now *(portrait, 4:5)*

### Our Story → About Us map pins (optional photos)
Each pin on the story map can carry a photo of the two of you in that place.
These are optional — pins work fine without them. To add or change which
places appear, edit `SETTINGS.storyMap` near the top of `index.html`; the
`img:` value there must match one of these flat names.
- [ ] `images_story-stlouis.jpg` — St Louis (where Megan grew up)
- [ ] `images_story-stalbans.jpg` — St Albans (home)
- [ ] `images_story-camino.jpg` — the Camino
- [ ] `images_story-paris.jpg` — (example travel pin — rename to your real places)
- [ ] *…add one `images_story-<place>.jpg` per pin you create*

### Our Story → Bridal Party
One portrait per person. The dog gets one too.
- [ ] `images_party-1.jpg` — Maid of Honour *(portrait)*
- [ ] `images_party-2.jpg` — Best Man *(portrait)*
- [ ] `images_party-3.jpg` — Bridesmaid *(portrait)*
- [ ] `images_party-4.jpg` — Bridesmaid *(portrait)*
- [ ] `images_party-5.jpg` — Groomsman *(portrait)*
- [ ] `images_party-6.jpg` — Groomsman *(portrait)*
- [ ] `images_party-kiko.jpg` — Kiko, the Dog of Honour *(portrait)*

### Our Story → Generations of Love
The love stories before yours — older family wedding photos. Add captions in
`index.html` next to each slot.
- [ ] `images_generations-1.jpg`
- [ ] `images_generations-2.jpg`
- [ ] `images_generations-3.jpg`
- [ ] `images_generations-4.jpg`
- [ ] `images_generations-5.jpg`
- [ ] `images_generations-6.jpg`
- [ ] *…to add more, copy a frame block in the page (search `generations-`) and
  continue the numbering: `images_generations-7.jpg`, `-8`, …*

### Our Story → In Memory
The gentle tribute page.
- [ ] `images_memory-1.jpg`
- [ ] `images_memory-2.jpg`
- [ ] `images_memory-3.jpg`
- [ ] `images_memory-4.jpg`

### Our Story → Behind the Scenes
Planning photos, added as you go. Six slots exist; more can be added.
- [ ] `images_bts-1.jpg`
- [ ] `images_bts-2.jpg`
- [ ] `images_bts-3.jpg`
- [ ] `images_bts-4.jpg`
- [ ] `images_bts-5.jpg`
- [ ] `images_bts-6.jpg`
- [ ] `images_bts-7.jpg` *(extra slots already wired in)*
- [ ] `images_bts-8.jpg`
- [ ] *…to add more, copy a frame block (search `bts-frame`) and continue:
  `images_bts-9.jpg`, …*

### Celebrations → Pre-Wedding Celebration
- [ ] `images_vinko.jpg` — header photo *(wide)*
- [ ] `images_vinko-1.jpg` — celebration photo
- [ ] `images_vinko-2.jpg` — celebration photo

### Keepsakes → Guestbook (a starter photo, optional)
- [ ] `images_guestbook-1.jpg` — an example wall photo *(optional — the wall
  mostly fills itself from guests' own uploads)*

---

## The guest photo walls (you don't upload these)

The Guestbook has two living photo mosaics — **Before the day** and
**After the day**. Those photos come from **guests**, not from this list:
when a guest pins a photo it's saved to your Google Drive folder automatically
(see `GOOGLE-DRIVE-SETUP.md`). You moderate them by deleting rows/files in
Drive. So there's nothing to upload here — just let them roll in.

If you'd rather host the big post-wedding album elsewhere (Google Photos etc.),
put that link in `SETTINGS.photoAlbum` and it appears as a button on the
"After the day" tab.

---

## Quick workflow for a big batch

1. Gather your photos and rename them to the exact names above
   (e.g. `images_generations-1.jpg` … `images_generations-30.jpg`).
   Remember: **`images_` with an underscore, never `images/` with a slash.**
2. Drag the whole set into the site folder alongside `index.html`.
3. Redeploy to Netlify (drag the folder onto Netlify as usual).
4. Refresh the live site — the new photos appear in their slots. Any name that
   doesn't match simply won't show, so a typo is harmless: fix the name and
   redeploy.

That's it. Add as many or as few as you like, whenever you like.
