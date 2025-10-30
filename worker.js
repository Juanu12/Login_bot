// worker.js (CommonJS)
const { chromium } = require('playwright');
require('dotenv').config();
const fs = require('fs');

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function clickWhenReady(locator, label = 'elemento', opts = {}) {
  const { appearTimeout = 30000, enabledTimeout = 30000, clickTimeout = 15000 } = opts;
  await locator.waitFor({ state: 'visible', timeout: appearTimeout });

  const t0 = Date.now();
  while (!(await locator.isEnabled().catch(() => false))) {
    if (Date.now() - t0 > enabledTimeout) throw new Error(`${label} visible pero no habilitado`);
    await sleep(120);
  }

  try { await locator.click({ trial: true, timeout: clickTimeout }); } catch {}
  await locator.click({ timeout: clickTimeout });
  console.log(`✅ Click en ${label}`);
}

async function registerCandidate(payload) {
  // Mapear datos que vienen del Set de n8n
  const {
    Nombre,
    Apellidos,
    Noidentificacion,
    Ubicacion,
    'Area de trabajo': AreaTrabajo,
    Lider,
    Rol,
    'Fecha de inicio': FechaInicio,
    'Descripcion/Responsabilidades': Descripcion
  } = payload || {};

  if (!Nombre && !Apellidos && !Noidentificacion) {
    throw new Error('Payload vacío o faltan campos mínimos');
  }

  const URL = process.env.URL; // tu login/home
  const TARGET_URL = process.env.TARGET_URL || URL; // o una ruta directa al módulo
  const HEADLESS = process.env.HEADLESS === 'false' ? false : true;
  const STORAGE_STATE = process.env.STORAGE_STATE || 'storage/auth.json'; // lo que genera global-setup
  const RUTA_MENU = (process.env.RUTA_MENU || 'Compras e Inventarios>Proveedores').split('>'); // opcional

  let browser;
  try {
    // usamos la sesión guardada
    const useStorage = fs.existsSync(STORAGE_STATE);
    browser = await chromium.launch({ headless: HEADLESS, slowMo: 60 });
    const context = useStorage
      ? await browser.newContext({ storageState: STORAGE_STATE })
      : await browser.newContext();

    const page = await context.newPage();
    await page.goto(TARGET_URL || URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // ====== Navegación opcional por menú izquierdo (igual que en tu setup) ======
    for (const label of RUTA_MENU) {
      const loc = page.locator(`xpath=//*[normalize-space(text())="${label}"]`);
      const count = await loc.count();
      if (!count) continue;
      const el = loc.first();
      try { await el.scrollIntoViewIfNeeded(); } catch {}
      try { await el.click({ timeout: 4000 }); }
      catch { await el.click({ force: true, timeout: 4000 }).catch(() => {}); }
      await sleep(300);
    }

    // Click en "Crear" (como en tu setup)
    const botonCrear = page.locator('xpath=//*[normalize-space(text())="Crear"]');
    if (await botonCrear.first().isVisible().catch(() => false)) {
      await botonCrear.first().scrollIntoViewIfNeeded();
      await botonCrear.first().click({ timeout: 5000 }).catch(() => {});
      console.log('✅ Click en "Crear"');
    }

    // ====== EJEMPLOS DE RELLENO (cambia selectores a los de tu app) ======

    // Tipo de Identificación (tu código DevExtreme)
    const campoTipo = page.locator('.dx-lookup-field', { hasText: 'Tipo de Identificación' });
    if (await campoTipo.first().isVisible().catch(() => false)) {
      await campoTipo.first().click({ timeout: 5000 });
      await page.locator('.dx-item-content', { hasText: 'CÉDULA DE CIUDADANÍA' }).first().click({ timeout: 5000 });
    }

    // Nombre
    if (Nombre) {
      // usa getByLabel si tu input tiene label accesible:
      // await page.getByLabel('Nombre').fill(Nombre);
      await page.locator('#nombre, input[name="Nombre"]').first().fill(Nombre).catch(()=>{});
    }

    // Apellidos
    if (Apellidos) {
      await page.locator('#apellidos, input[name="Apellidos"]').first().fill(Apellidos).catch(()=>{});
    }

    // No. identificación
    if (Noidentificacion) {
      await page.locator('#identificacion, input[name="Noidentificacion"], input[name="Identificacion"]').first()
        .fill(String(Noidentificacion)).catch(()=>{});
    }

    if (Ubicacion) {
      await page.locator('#ubicacion, input[name="Ubicacion"]').first().fill(Ubicacion).catch(()=>{});
    }

    if (AreaTrabajo) {
      // si es select DevExtreme:
      // abre el lookup del campo area y elige por texto
      const areaField = page.locator('.dx-lookup-field', { hasText: /Área|Area/i }).first();
      if (await areaField.isVisible().catch(()=>false)) {
        await areaField.click().catch(()=>{});
        await page.locator('.dx-item-content', { hasText: AreaTrabajo }).first().click({ timeout: 5000 }).catch(()=>{});
      } else {
        // select nativo o input
        await page.selectOption('#area', { label: AreaTrabajo }).catch(()=>{});
        await page.locator('input[name="Area"]').first().fill(AreaTrabajo).catch(()=>{});
      }
    }

    if (Lider) {
      await page.locator('#lider, input[name="Lider"]').first().fill(Lider).catch(()=>{});
    }

    if (Rol) {
      await page.locator('#rol, input[name="Rol"]').first().fill(Rol).catch(()=>{});
    }

    if (FechaInicio) {
      await page.locator('#fechaInicio, input[type="date"], input[name="FechaInicio"]').first()
        .fill(FechaInicio).catch(()=>{});
    }

    if (Descripcion) {
      await page.locator('#descripcion, textarea[name="Descripcion"]').first().fill(Descripcion).catch(()=>{});
    }

    // Guardar / Enviar
    const guardar = page.locator('button:has-text("Guardar"), button[type="submit"], input[type="submit"]');
    if (await guardar.first().isVisible().catch(()=>false)) {
      await clickWhenReady(guardar.first(), 'Guardar/Submit');
    }

    // Confirmación (ajusta a tu app)
    await page.waitForSelector('.alert-success, text=Guardado, text=¡Guardado!', { timeout: 15000 }).catch(()=>{});

    await context.storageState({ path: STORAGE_STATE }); // refresca sesión por si cambió
    await browser.close();
    return { message: 'Formulario enviado (worker)' };
  } catch (e) {
    try { if (browser) await browser.close(); } catch {}
    throw e;
  }
}

module.exports = { registerCandidate };
