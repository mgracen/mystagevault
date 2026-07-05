const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ── DB setup ────────────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'mystagevault.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS shelf (
    device_id TEXT NOT NULL,
    play_key  TEXT NOT NULL,
    status    TEXT NOT NULL CHECK(status IN ('read','reading','want')),
    PRIMARY KEY (device_id, play_key)
  );

  CREATE TABLE IF NOT EXISTS ratings (
    device_id TEXT NOT NULL,
    play_key  TEXT NOT NULL,
    rating    INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    PRIMARY KEY (device_id, play_key)
  );

  CREATE TABLE IF NOT EXISTS notes (
    device_id  TEXT NOT NULL,
    play_key   TEXT NOT NULL,
    note       TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (device_id, play_key)
  );
`);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Open Library proxy ───────────────────────────────────────────────────────
// We proxy OL so the frontend doesn't need to deal with CORS or rate limits
app.get('/api/search', async (req, res) => {
  const q = req.query.q || '';
  const page = parseInt(req.query.page) || 1;
  if (!q.trim()) return res.json({ docs: [], numFound: 0 });

  // Restrict to plays / drama using subject filter
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&subject=drama&fields=key,title,author_name,first_publish_year,subject,cover_i,edition_count&limit=20&page=${page}`;

  try {
    const olRes = await fetch(url, {
      headers: { 'User-Agent': 'My Stage Vault/1.0 (play-tracker; contact@mystagevault.app)' }
    });
    const data = await olRes.json();
    res.json(data);
  } catch (err) {
    console.error('OL search error:', err);
    res.status(502).json({ error: 'Search service unavailable' });
  }
});

app.get('/api/play/:olKey(*)', async (req, res) => {
  const olKey = '/' + req.params.olKey;
  try {
    const [workRes, ratingsRes] = await Promise.all([
      fetch(`https://openlibrary.org${olKey}.json`, {
        headers: { 'User-Agent': 'My Stage Vault/1.0 (play-tracker; contact@mystagevault.app)' }
      }),
      fetch(`https://openlibrary.org${olKey}/ratings.json`, {
        headers: { 'User-Agent': 'My Stage Vault/1.0 (play-tracker; contact@mystagevault.app)' }
      })
    ]);
    const work = await workRes.json();
    let olRatings = {};
    try { olRatings = await ratingsRes.json(); } catch {}
    res.json({ work, olRatings });
  } catch (err) {
    res.status(502).json({ error: 'Could not fetch play details' });
  }
});

// ── Shelf endpoints ──────────────────────────────────────────────────────────
app.get('/api/shelf/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const rows = db.prepare('SELECT play_key, status FROM shelf WHERE device_id = ?').all(deviceId);
  res.json(rows);
});

app.put('/api/shelf/:deviceId/:playKey(*)', (req, res) => {
  const { deviceId, playKey } = req.params;
  const { status } = req.body;
  if (!['read', 'reading', 'want'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('INSERT OR REPLACE INTO shelf (device_id, play_key, status) VALUES (?,?,?)')
    .run(deviceId, playKey, status);
  res.json({ ok: true });
});

app.delete('/api/shelf/:deviceId/:playKey(*)', (req, res) => {
  const { deviceId, playKey } = req.params;
  db.prepare('DELETE FROM shelf WHERE device_id=? AND play_key=?').run(deviceId, playKey);
  res.json({ ok: true });
});

// ── Ratings ──────────────────────────────────────────────────────────────────
app.get('/api/ratings/:deviceId', (req, res) => {
  const rows = db.prepare('SELECT play_key, rating FROM ratings WHERE device_id=?').all(req.params.deviceId);
  res.json(rows);
});

app.put('/api/ratings/:deviceId/:playKey(*)', (req, res) => {
  const { deviceId, playKey } = req.params;
  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Invalid rating' });
  db.prepare('INSERT OR REPLACE INTO ratings (device_id, play_key, rating) VALUES (?,?,?)').run(deviceId, playKey, rating);
  res.json({ ok: true });
});

// ── Notes ────────────────────────────────────────────────────────────────────
app.get('/api/notes/:deviceId', (req, res) => {
  const rows = db.prepare('SELECT play_key, note, updated_at FROM notes WHERE device_id=?').all(req.params.deviceId);
  res.json(rows);
});

app.put('/api/notes/:deviceId/:playKey(*)', (req, res) => {
  const { deviceId, playKey } = req.params;
  const { note } = req.body;
  db.prepare(`INSERT OR REPLACE INTO notes (device_id, play_key, note, updated_at)
    VALUES (?,?,?,datetime('now'))`).run(deviceId, playKey, note || '');
  res.json({ ok: true });
});

// ── Curated data (monologues, scenes, tags, recs) ───────────────────────────
const CURATED_PATH = path.join(__dirname, 'curated.json');
let curated = {};
if (fs.existsSync(CURATED_PATH)) {
  curated = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'));
}

app.get('/api/curated', (req, res) => res.json(curated));

app.get('/api/curated/:olKey(*)', (req, res) => {
  const key = '/' + req.params.olKey;
  res.json(curated[key] || {});
});

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.listen(PORT, () => console.log(`My Stage Vault backend running on port ${PORT}`));
