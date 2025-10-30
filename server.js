// server.js (CommonJS)
require('dotenv').config();
const express = require('express');
const { registerCandidate } = require('./worker'); // llamamos al worker Playwright

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// n8n llamará aquí con el JSON de tu Set
app.post('/register-candidate', async (req, res) => {
  try {
    const result = await registerCandidate(req.body);
    res.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Worker escuchando en http://localhost:${PORT}`));
