// tests/global-setup.js
const { chromium } = require('playwright');
require('dotenv').config();

/* Utilidad para esperar visibilidad y clic fiable */
async function clickWhenReady(locator, label = 'elemento', opts = {}) {
  const { appearTimeout = 30000, enabledTimeout = 30000, clickTimeout = 15000 } = opts;
  await locator.waitFor({ state: 'visible', timeout: appearTimeout });

  const t0 = Date.now();
  while (!(await locator.isEnabled().catch(() => false))) {
    if (Date.now() - t0 > enabledTimeout) throw new Error(`${label} visible pero no habilitado`);
    await new Promise(r => setTimeout(r, 120));
  }

  try { await locator.click({ trial: true, timeout: clickTimeout }); } catch {}
  await locator.click({ timeout: clickTimeout });
  console.log(`✅ Click en ${label}`);
}

/* Espera (máx. 20s) a que aparezca algún modal tras el login */
async function waitForModalOrDashboard(page, timeoutMs = 20000) {
  const modalCandidates = [
    '.modal.show', '.modal.in', '[role="dialog"]',
    '.swal2-container', 'button:has-text("OK")', 'input[value="OK"]'
  ];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sel of modalCandidates) {
      const loc = page.locator(sel);
      if (await loc.first().isVisible().catch(() => false)) {
        return { found: 'modal', selector: sel };
      }
    }
    if (page.isClosed()) break;
    await new Promise(r => setTimeout(r, 250));
  }
  return { found: 'none' };
}

/* Cierra el modal superior (OK / Cerrar) si aparece */
async function closeTopModalIfAny(page) {
  const seen = await waitForModalOrDashboard(page, 20000);
  if (seen.found !== 'modal') {
    console.log('ℹ️ No se detectó modal tras el login (continuamos).');
    return;
  }

  console.log(`🪟 Modal detectado (${seen.selector}). Intentando cerrar…`);
  let modal = page.locator('.modal.show');
  if (!(await modal.first().isVisible().catch(() => false))) {
    modal = page.locator('.modal.in');
  }
  const scope = (await modal.first().isVisible().catch(() => false)) ? modal.first() : page;

  let ok = scope.getByRole('button', { name: /^ok$/i });
  if (!(await ok.isVisible().catch(() => false))) {
    ok = scope.locator('button:has-text("OK"), input[type="button"][value="OK"], input[type="submit"][value="OK"]');
  }

  if (await ok.first().isVisible().catch(() => false)) {
    try { await clickWhenReady(ok.first(), 'OK (modal)'); }
    catch { await ok.first().click({ force: true, timeout: 2000 }).catch(() => {}); }
  } else {
    const cerrar = scope.getByRole('button', { name: /cerrar/i });
    if (await cerrar.isVisible().catch(() => false)) {
      await clickWhenReady(cerrar, 'Cerrar (modal)');
    } else {
      await scope.evaluate(el => {
        const b = el.querySelector('button, input[type="button"], input[type="submit"]');
        if (b) b.click();
      }).catch(() => {});
    }
  }

  await page.locator('.modal.show, .modal.in').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('.modal-backdrop, .swal2-container, .k-overlay').forEach(e => e.remove());
  }).catch(() => {});
  console.log('✅ Modal cerrado (o neutralizado).');
}

/* Cierra la franja inferior “Cerrar ×” si existe */
async function closeBottomBannerIfAny(page) {
  const candidates = [
    page.getByRole('button', { name: /cerrar/i }),
    page.locator('a:has-text("Cerrar")'),
    page.locator('button:has-text("Cerrar")'),
    page.locator('span:has-text("Cerrar")')
  ];
  for (const loc of candidates) {
    if (await loc.first().isVisible().catch(() => false)) {
      try { await clickWhenReady(loc.first(), 'Cerrar (banner)'); return; }
      catch { await loc.first().click({ force: true }).catch(() => {}); return; }
    }
  }
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('a,button,span')].find(el => /cerrar/i.test(el.textContent||''));
    if (t) t.click();
  }).catch(() => {});
}

/* ========= Navegación por menú SOLO en la barra izquierda =========
   Elige el elemento más a la IZQUIERDA cuyo texto visible coincida exactamente. */
async function findLeftmostClickable(scope, page, text) {
  const nodes = scope.locator(`xpath=//*[normalize-space(text())="${text}"]`);
  const count = await nodes.count();
  if (!count) return null;

  let best = null;
  let bestX = Infinity;

  const vp = page.viewportSize ? page.viewportSize() : null;
  const pageWidth = vp ? vp.width : 1200;
  const leftThreshold = pageWidth / 2; // mitad izquierda

  for (let i = 0; i < count; i++) {
    const n = nodes.nth(i);
    // sube al ancestro clickeable si existe
    const clickable = n.locator(
      'xpath=ancestor-or-self::*[self::a or self::button or @role="button" or @onclick][1]'
    );
    const target = (await clickable.count()) ? clickable.first() : n.first();

    if (!(await target.isVisible().catch(() => false))) continue;

    const box = await target.boundingBox().catch(() => null);
    if (!box) continue;

    // solo consideramos elementos a la izquierda
    if (box.x > leftThreshold) continue;

    if (box.x < bestX) {
      bestX = box.x;
      best = target;
    }
  }
  return best;
}

async function clickLeftMenu(scope, page, label) {
  const el = await findLeftmostClickable(scope, page, label);
  if (!el) return false;
  try { await el.scrollIntoViewIfNeeded(); } catch {}
  try { await el.hover({ timeout: 1200 }); } catch {}
  try { await el.click({ timeout: 3000 }); }
  catch { await el.click({ force: true, timeout: 3000 }).catch(() => {}); }
  console.log(`✅ Click (izquierda) en ${label}`);
  await new Promise(r => setTimeout(r, 250));
  return true;
}

/* ===================== Flujo principal ===================== */
module.exports = async () => {
  const url  = process.env.URL;
  const user = process.env.USER;
  const pass = process.env.PASS;
  if (!url || !user || !pass) throw new Error('❌ Faltan URL, USER o PASS en .env');

  const browser = await chromium.launch({ headless: false, slowMo: 180 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🌐 Abriendo tu página…');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await clickWhenReady(page.getByPlaceholder('Usuario'), 'campo Usuario');
    await page.getByPlaceholder('Usuario').fill(user);
    await clickWhenReady(page.getByPlaceholder('Contraseña'), 'campo Contraseña');
    await page.getByPlaceholder('Contraseña').fill(pass);
    await clickWhenReady(page.getByRole('button', { name: /Ingresar/i }), 'botón Ingresar');

    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: 60000 }),
      (async () => { await waitForModalOrDashboard(page, 20000); })()
    ]).catch(() => {});

    await closeTopModalIfAny(page);
    await closeBottomBannerIfAny(page);

    // 🔽 Navegación exacta por la barra lateral (textos visibles)
    const ruta = ["Compras e Inventarios", "Proveedores"];

    // 1) prioriza contenedores típicos de sidebar
    const sidebarSelectors = [
      '.sidebar-menu', '.sidebar', 'aside', 'nav[role="navigation"]', '.navigation', '.k-menu', '.k-panelbar'
    ];

    let navego = false;
    for (const sel of sidebarSelectors) {
      const area = page.locator(sel).first();
      if (await area.isVisible().catch(() => false)) {
        console.log('🧭 Usando sidebar:', sel);
        navego = true;
        for (const label of ruta) {
          const ok = await clickLeftMenu(area, page, label);
          if (!ok) { navego = false; break; }
          await new Promise(r => setTimeout(r, 500)); // por animaciones
        }
        if (navego) break;
      }
    }

    // 2) si no hay sidebar detectable, usa toda la página (pero solo lado izquierdo)
    if (!navego) {
      navego = true;
      for (const label of ruta) {
        const ok = await clickLeftMenu(page, page, label);
        if (!ok) { navego = false; break; }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (!navego) {
      console.warn('⚠️ No se pudo navegar por el menú izquierdo. Guardando evidencia…');
      await page.screenshot({ path: 'menu_fail.png', fullPage: true });
    }
const botonCrear = page.locator('xpath=//*[normalize-space(text())="Crear"]');

if (await botonCrear.first().isVisible().catch(() => false)) {
  await botonCrear.first().scrollIntoViewIfNeeded();
  await botonCrear.first().click({ timeout: 5000 }).catch(() => {});
  console.log('✅ Click en elemento con texto "Crear"');
} else {
  console.warn('⚠️ No se encontró ningún elemento con texto "Crear"');
}

// 🧠 Seleccionar "CÉDULA DE CIUDADANÍA" en campo Tipo de Identificación (DevExtreme)
try {
  // Buscar el campo visible que contenga la etiqueta
  const campoTipo = page.locator('.dx-lookup-field', { hasText: 'Tipo de Identificación' });

  if (await campoTipo.first().isVisible().catch(() => false)) {
    console.log('🔍 Campo "Tipo de Identificación" encontrado, abriendo lista...');
    await campoTipo.first().click({ timeout: 5000 });
    await page.waitForTimeout(500); // tiempo para que se abra el panel

    // Ahora buscar la opción en el panel desplegado
    const opcionCedula = page.locator('.dx-item-content', { hasText: 'CÉDULA DE CIUDADANÍA' });
    await opcionCedula.first().click({ timeout: 5000 });
    console.log('✅ Seleccionado: CÉDULA DE CIUDADANÍA');
  } else {
    // fallback si el label no está dentro del campo
    const campoAlt = page.locator('.dx-lookup-field').nth(0); // primer lookup visible
    if (await campoAlt.isVisible().catch(() => false)) {
      console.log('🔍 Usando primer .dx-lookup-field visible (fallback)');
      await campoAlt.click({ timeout: 5000 });
      await page.waitForTimeout(500);
      const opcionCedula = page.locator('.dx-item-content', { hasText: 'CÉDULA DE CIUDADANÍA' });
      await opcionCedula.first().click({ timeout: 5000 });
      console.log('✅ Seleccionado (fallback): CÉDULA DE CIUDADANÍA');
    } else {
      console.warn('⚠️ No se encontró el campo "Tipo de Identificación" visible.');
    }
  }
} catch (err) {
  console.error('❌ Error al seleccionar el Tipo de Identificación:', err.message);
}


    await page.waitForLoadState('networkidle', { timeout: 20000 });
    await page.screenshot({ path: 'global_setup_ok.png', fullPage: true });

    await context.storageState({ path: 'storage/auth.json' });
    console.log('✅ Sesión guardada en storage/auth.json');
  } catch (e) {
    try {
      await page.screenshot({ path: 'global_setup_error.png', fullPage: true });
      const html = await page.content();
      require('fs').writeFileSync('global_setup_error.html', html, 'utf8');
      console.error('📸 Evidencias guardadas (global_setup_error.*)');
    } catch {}
    throw e;
  } finally {
    await browser.close();
  }
};
