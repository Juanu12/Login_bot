// tests/register-candidate.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');

test('register-candidate', async ({ page, baseURL }) => {
  const payloadPath = process.env.PAYLOAD_PATH;

  if (!payloadPath || !fs.existsSync(payloadPath)) {
    throw new Error('PAYLOAD_PATH no definido o archivo no existe');
  }

  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

  const { Nombre, Apellidos, Noidentificacion } = payload;
  if (!Nombre || !Apellidos || !Noidentificacion) {
    throw new Error('Faltan campos requeridos (Nombre, Apellidos, Noidentificacion)');
  }

  // baseURL viene de playwright.config.js (process.env.URL en Azure)
  await page.goto(baseURL ?? process.env.URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  await page.locator('#nombre, input[name="Nombre"]').first().fill(String(Nombre));
  await page.locator('#apellidos, input[name="Apellidos"]').first().fill(String(Apellidos));
  await page
    .locator('#identificacion, input[name="Noidentificacion"], input[name="Identificacion"]')
    .first()
    .fill(String(Noidentificacion));

  const guardar = page.locator('button:has-text("Guardar"), button[type="submit"], input[type="submit"]');
  if (await guardar.first().isVisible().catch(() => false)) {
    await guardar.first().click();
  }

  // Ejemplo de verificación suave (opcional)
  // await expect(page.locator('.alert-success')).toBeVisible({ timeout: 15000 });
});
