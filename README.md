# My Stage Vault

A free tool for theatre people. Track plays you have read, discover monologues and scenes, and build your script book.

**Live app:** https://mgracen.github.io/mystagevault/app.html  
**Backend:** https://mystagevault-production.up.railway.app  
**Domain (coming):** mystagevault.com

---

## What it does

- **Discover** -- 50 curated plays with a themed weekly featured section that rotates automatically across 10 themes
- **My shelf** -- mark plays as Read, Currently Reading, or Want to Read; data saves to Railway backend and persists across sessions
- **Play search** -- search by title, playwright, or theme; extends to Open Library for plays beyond the curated 50
- **Monologue search** -- free text search across all monologues in the vault; filter by character gender, type, and era
- **Scene search** -- free text search across all scenes; filter by cast mix and era
- **Detail panel** -- rate plays, write private notes, get script links to Concord Theatricals, Dramatists Play Service, and WorldCat
- **Theatre card** -- generates a shareable image of your reading stats and shelf

---

## Architecture

```
frontend/
  app.html        Single self-contained file. All CSS, JS, and play data baked in.
                  No build step. No framework. Deploys via GitHub Pages.

backend/
  server.js       Node.js / Express. JSON file storage.
                  Endpoints: shelf, ratings, notes per device ID.
  package.json    Dependencies: express, cors only.

.github/
  workflows/
    deploy.yml    GitHub Actions -- deploys frontend/ to GitHub Pages on push to main.
```

---

## Data structure

Each play in the PLAYS array:

```js
{
  id: 1,
  key: 'OL17860290W',       // Open Library work key
  title: 'Angels in America',
  author: 'Tony Kushner',
  year: 1991,
  genre: 'Drama',
  era: '1990s',
  cast: 'large',            // solo / small / medium / large / flexible
  castSize: 8,
  gender: 'mixed',          // mixed / female / male
  themes: ['AIDS', 'politics', 'queerness'],
  color: '#533AB7',         // fallback card color
  cov: 10527584,            // Open Library cover ID (null if none)
  desc: 'Description...',
  rids: [2, 14, 5],         // recommended play IDs
  rwhy: ['reason 1', ...],  // why each rec
  monos: [
    {
      ch: 'Prior Walter',   // character name
      g: 'm',               // f / m / nb
      t: 'Dramatic',        // Dramatic / Comedic / Seriocomic / Tragic
      d: 'Description...',  // what makes this monologue interesting
      ex: 'Sample text...", // optional excerpt
      exsrc: 'Source note'  // attribution for excerpt
    }
  ],
  scenes: [
    {
      ch: [{n: 'Prior', g: 'm'}, {n: 'Louis', g: 'm'}],
      t: 'Dramatic',
      d: 'Description...'
    }
  ]
}
```

---

## Backend API

All endpoints are scoped by `deviceId` (stored in localStorage, generated on first visit).

```
GET  /api/health                          Health check
GET  /api/shelf/:deviceId                 Get all shelf entries
PUT  /api/shelf/:deviceId/:playKey        Set shelf status {status: 'read'|'reading'|'want'}
DEL  /api/shelf/:deviceId/:playKey        Remove from shelf
GET  /api/ratings/:deviceId              Get all ratings
PUT  /api/ratings/:deviceId/:playKey     Set rating {rating: 1-5}
GET  /api/notes/:deviceId               Get all notes
PUT  /api/notes/:deviceId/:playKey      Set note {note: 'text'}
```

---

## Deploy: frontend to GitHub Pages

1. Push to `main` branch
2. GitHub Actions runs `.github/workflows/deploy.yml` automatically
3. Deploys `frontend/` to GitHub Pages
4. Live at `https://YOUR-USERNAME.github.io/mystagevault/`

---

## Deploy: backend to Railway

1. railway.app -- New Project -- Deploy from GitHub repo
2. Select this repo, set Root Directory to `backend`
3. Set Start Command to `node server.js`
4. Generate a public domain under Settings -- Networking
5. Set target port to `8080`
6. Update `var API = '...'` in `frontend/app.html` with your Railway URL
7. Test: `YOUR-RAILWAY-URL/api/health` should return `{"status":"ok"}`

---

## Point mystagevault.com at GitHub Pages (GoDaddy)

1. GitHub: Settings -- Pages -- Custom domain -- type `mystagevault.com` -- Save
2. GoDaddy DNS, add these records:
```
A      @      185.199.108.153
A      @      185.199.109.153
A      @      185.199.110.153
A      @      185.199.111.153
CNAME  www    mgracen.github.io
```
3. Wait up to 24 hours for DNS propagation
4. Enable Enforce HTTPS in GitHub Pages settings

---

## Adding more plays

Edit `frontend/app.html` and add entries to the `PLAYS` array following the data structure above. No backend changes needed -- all play data is client-side.

To find an Open Library cover ID:
```
https://openlibrary.org/search.json?q=TITLE+AUTHOR&subject=drama
```
Look for the `cover_i` field.

---

## Roadmap

- [ ] Expand curated catalogue to 200 plays
- [ ] User accounts and public profiles
- [ ] Shareable theatre card URL
- [ ] mystagevault.com domain live
- [ ] Mobile polish
