// server.js (CommonJS)
require('dotenv').config();
const express = require('express');
const { registerCandidate } = require('./worker');

const app = express();
app.use(express.json({ limit: '1mb' }));

// Raíz y health (útil para probar en Azure)
app.get('/', (_req, res) => res.send('API OK'));
app.get('/health', (_req, res) => res.json({ ok: true }));

// n8n debe llamar aquí
app.post('/register-candidate', async (req, res) => {
  try {
    const { Nombre, Apellidos, Noidentificacion } = req.body || {};
    if (!Nombre || !Apellidos || !Noidentificacion) {
      return res.status(400).json({
        ok: false,
        error: 'Campos requeridos: Nombre, Apellidos, Noidentificacion',
      });
    }

    const result = await registerCandidate({
      Nombre,
      Apellidos,
      Noidentificacion,
      ...req.body, // por si luego envías extras, no estorban
    });

    res.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// MUY IMPORTANTE para Azure: 0.0.0.0 y process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ API escuchando en puerto ${PORT}`);
});
