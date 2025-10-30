// worker.js (CommonJS)
const { chromium } = require('playwright');
require('dotenv').config();

async function registerCandidate(payload) {
  const { Nombre, Apellidos, Noidentificacion } = payload || {};
  if (!Nombre || !Apellidos || !Noidentificacion) {
    throw new Error('Faltan campos requeridos (Nombre, Apellidos, Noidentificacion)');
  }

  const URL = process.env.URL; // página inicial/login de tu app
  const HEADLESS = process.env.HEADLESS === 'false' ? false : true;

  let browser;
  try {
    browser = await chromium.launch({ headless: HEADLESS, slowMo: 60 });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // ====== RELLENO BÁSICO (ajusta los selectores a tu sistema) ======
    await page.locator('#nombre, input[name="Nombre"]').first()
      .fill(String(Nombre)).catch(() => {});
    await page.locator('#apellidos, input[name="Apellidos"]').first()
      .fill(String(Apellidos)).catch(() => {});
    await page.locator('#identificacion, input[name="Noidentificacion"], input[name="Identificacion"]').first()
      .fill(String(Noidentificacion)).catch(() => {});

    // Guardar/Enviar (si existe)
    const guardar = page.locator('button:has-text("Guardar"), button[type="submit"], input[type="submit"]');
    if (await guardar.first().isVisible().catch(() => false)) {
      await guardar.first().click().catch(() => {});
    }

    await browser.close();
    return { message: 'Formulario enviado', data: { Nombre, Apellidos, Noidentificacion } };
  } catch (e) {
    try { if (browser) await browser.close(); } catch {}
    throw e;
  }
}

module.exports = { registerCandidate };
