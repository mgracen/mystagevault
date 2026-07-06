const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const data = { shelf: {}, ratings: {}, notes: {} };

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/shelf/:id', (req, res) => {
  const s = data.shelf[req.params.id] || {};
  res.json(Object.entries(s).map(([k,v]) => ({ play_key:k, status:v })));
});
app.put('/api/shelf/:id/:key(*)', (req, res) => {
  if (!data.shelf[req.params.id]) data.shelf[req.params.id] = {};
  data.shelf[req.params.id][req.params.key] = req.body.status;
  res.json({ ok: true });
});
app.delete('/api/shelf/:id/:key(*)', (req, res) => {
  if (data.shelf[req.params.id]) delete data.shelf[req.params.id][req.params.key];
  res.json({ ok: true });
});

app.get('/api/ratings/:id', (req, res) => {
  const r = data.ratings[req.params.id] || {};
  res.json(Object.entries(r).map(([k,v]) => ({ play_key:k, rating:v })));
});
app.put('/api/ratings/:id/:key(*)', (req, res) => {
  if (!data.ratings[req.params.id]) data.ratings[req.params.id] = {};
  data.ratings[req.params.id][req.params.key] = req.body.rating;
  res.json({ ok: true });
});

app.get('/api/notes/:id', (req, res) => {
  const n = data.notes[req.params.id] || {};
  res.json(Object.entries(n).map(([k,v]) => ({ play_key:k, note:v })));
});
app.put('/api/notes/:id/:key(*)', (req, res) => {
  if (!data.notes[req.params.id]) data.notes[req.params.id] = {};
  data.notes[req.params.id][req.params.key] = req.body.note || '';
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3001, () => console.log('running'));
