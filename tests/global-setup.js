// tests/global-setup.js — Login + menú + Crear + abrir/seleccionar “Tipo de Identificación” (lado izquierdo) + REPORTE HTML
const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config();

/* ================== Reporte HTML ================== */
const R = { steps: [], shots: [], blobs: {} };
function nowTs(){ const d=new Date(); return d.toISOString().split('T')[1].replace('Z',''); }
function logOK (msg){ R.steps.push({ts:nowTs(), level:'ok',  msg});  console.log(`✅ ${msg}`); }
function logWARN(msg){ R.steps.push({ts:nowTs(), level:'warn',msg});  console.warn(`⚠️ ${msg}`); }
function logERR(msg){ R.steps.push({ts:nowTs(), level:'err', msg});  console.error(`❌ ${msg}`); }
function logINFO(msg){ R.steps.push({ts:nowTs(), level:'info',msg});  console.log(`ℹ️ ${msg}`); }
async function shot(page, file, caption){
  try{ if(page && !page.isClosed()) await page.screenshot({path:file, fullPage:true}); }catch{}
  R.shots.push({file, caption});
}
function saveReport(){
  try{
    const badge = l => l==='ok' ? '#16a34a' : l==='warn' ? '#eab308' : l==='err' ? '#dc2626' : '#2563eb';
    const esc = s => (s??'').toString();
    const stepRows = R.steps.map(s=>`
      <tr>
        <td style="white-space:nowrap">${esc(s.ts)}</td>
        <td><span style="display:inline-block;padding:.1rem .35rem;border-radius:.375rem;background:${badge(s.level)};color:white;font-size:.75rem">${s.level.toUpperCase()}</span></td>
        <td>${esc(s.msg)}</td>
      </tr>`).join('');
    const shots = R.shots.map(s=>`
      <figure style="margin:0 0 1.25rem 0">
        <figcaption style="font:600 14px system-ui;margin:.25rem 0 .5rem 0">${esc(s.caption)} — <code>${esc(s.file)}</code></figcaption>
        <img src="${esc(s.file)}" style="max-width:100%;border:1px solid #e5e7eb;border-radius:.5rem"/>
      </figure>`).join('');
    const block = (title, key) => R.blobs[key] ? `
      <section style="margin:1rem 0">
        <h3 style="font:600 16px system-ui;margin:.25rem 0 .5rem 0">${title}</h3>
        <pre style="white-space:pre-wrap;background:#0b1020;color:#e5e7eb;padding:12px;border-radius:8px;border:1px solid #1f2937">${R.blobs[key]}</pre>
      </section>` : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Reporte selector TDI</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:24px;background:#0a0f1a;color:#e5e7eb;font:14px/1.45 system-ui,Segoe UI,Roboto,Arial">
  <h1 style="font:700 22px system-ui;margin:.25rem 0 1rem 0">Reporte: Selector “Tipo de Identificación”</h1>
  <h2 style="font:600 18px system-ui;margin:1rem 0 .5rem 0">Timeline</h2>
  <table style="width:100%;border-collapse:collapse;border:1px solid #1f2937">
    <thead><tr style="background:#111827">
      <th style="text-align:left;padding:.5rem;border-bottom:1px solid #1f2937">Hora</th>
      <th style="text-align:left;padding:.5rem;border-bottom:1px solid #1f2937">Nivel</th>
      <th style="text-align:left;padding:.5rem;border-bottom:1px solid #1f2937">Mensaje</th>
    </tr></thead>
    <tbody>${stepRows}</tbody>
  </table>
  <h2 style="font:600 18px system-ui;margin:1rem 0 .25rem 0">Capturas</h2>
  ${shots || '<p style="opacity:.7">No se generaron capturas.</p>'}
  ${block('HTML — Fila con “*Tipo de documento”','rowHtml')}
  ${block('HTML — Host del selector (wrapper/control)','hostHtml')}
  ${block('HTML — Overlay/Listbox cercano detectado','overlayHtml')}
  ${block('Valor final aplicado en el control','valorFinalTDI')}
  <footer style="margin-top:2rem;opacity:.6">Generado: ${new Date().toLocaleString()}</footer>
</body></html>`;
    fs.writeFileSync('report_selector_tdi.html', html, 'utf8');
  }catch(e){ console.error('No se pudo escribir report_selector_tdi.html:', e.message); }
}

/* ================== Utils de flujo ================== */
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
async function clickWhenReady(locator, label='elemento', opts={}) {
  const { appearTimeout=30000, enabledTimeout=30000, clickTimeout=15000 } = opts;
  await locator.waitFor({ state:'visible', timeout:appearTimeout });
  const t0 = Date.now();
  while (!(await locator.isEnabled().catch(()=>false))) {
    if (Date.now()-t0>enabledTimeout) throw new Error(`${label} visible pero no habilitado`);
    await sleep(90);
  }
  try { await locator.click({ trial:true, timeout:clickTimeout }); } catch {}
  await locator.click({ timeout:clickTimeout });
  logOK(label);
}
async function waitForModalOrDashboard(page, timeoutMs=10000) {
  const sels=['.modal.show','.modal.in','[role="dialog"]','.swal2-container','button:has-text("OK")','input[value="OK"]'];
  const t0=Date.now();
  while(!page.isClosed() && Date.now()-t0<timeoutMs){
    for(const s of sels){ if(await page.locator(s).first().isVisible().catch(()=>false)) return {found:'modal',selector:s}; }
    await sleep(150);
  }
  return {found:'none'};
}
async function closeTopModalIfAny(page){
  const seen=await waitForModalOrDashboard(page,8000);
  if(seen.found!=='modal'){ logINFO('No se detectó modal tras el login.'); return; }
  const scope=(await page.locator('.modal.show').first().isVisible().catch(()=>false))
    ? page.locator('.modal.show').first()
    : (await page.locator('.modal.in').first().isVisible().catch(()=>false))
      ? page.locator('.modal.in').first() : page;

  let ok=scope.getByRole('button',{name:/^ok$/i}).first();
  if(!(await ok.isVisible().catch(()=>false))) ok=scope.locator('button:has-text("OK"), input[value="OK"]').first();
  if(await ok.isVisible().catch(()=>false)) await ok.click({timeout:2000}).catch(()=>{});
  else{
    const cer=scope.getByRole('button',{name:/cerrar/i}).first();
    if(await cer.isVisible().catch(()=>false)) await cer.click({timeout:2000}).catch(()=>{});
    else await scope.locator('button, input[type="button"], input[type="submit"]').first().click({timeout:2000}).catch(()=>{});
  }
  await page.locator('.modal.show, .modal.in').waitFor({state:'hidden',timeout:4000}).catch(()=>{});
  await page.evaluate(()=>{document.querySelectorAll('.modal-backdrop,.swal2-container,.k-overlay').forEach(e=>e.remove());}).catch(()=>{});
  logOK('Modal cerrado/limpiado');
}
async function closeBottomBannerIfAny(page) {
  const cands=[
    page.getByRole('button',{name:/cerrar/i}),
    page.locator('a:has-text("Cerrar")'),
    page.locator('button:has-text("Cerrar")'),
    page.locator('span:has-text("Cerrar")')
  ];
  for(const c of cands){
    if(await c.first().isVisible().catch(()=>false)){ await c.first().click({timeout:1500}).catch(()=>{}); logOK('Banner inferior cerrado'); return; }
  }
}

/* ====== Menú izquierda ====== */
async function findLeftmostClickable(scope, page, text) {
  try{
    const nodes = scope.locator(`xpath=//*[normalize-space(text())="${text}"]`);
    const count = await nodes.count().catch(()=>0);
    if (!count) return null;
    let best=null, bestX=Infinity;
    const vp = page.viewportSize?.() ?? {width:1200};
    const leftThreshold = vp.width/2;
    for (let i=0;i<count;i++){
      const n = nodes.nth(i);
      const clickable = n.locator('xpath=ancestor-or-self::*[self::a or self::button or @role="button" or @onclick][1]');
      const target = (await clickable.count().catch(()=>0)) ? clickable.first() : n.first();
      if (!(await target.isVisible().catch(()=>false))) continue;
      const box = await target.boundingBox().catch(()=>null); if(!box) continue;
      if (box.x>leftThreshold) continue;
      if (box.x<bestX) { bestX=box.x; best=target; }
    }
    return best;
  }catch{ return null; }
}
async function clickLeftMenu(scope, page, label){
  const el = await findLeftmostClickable(scope, page, label);
  if (!el) return false;
  try{ await el.scrollIntoViewIfNeeded(); }catch{}
  try{ await el.hover({timeout:1200}); }catch{}
  try{ await el.click({timeout:3000}); }catch{ await el.click({force:true, timeout:3000}).catch(()=>{}); }
  logOK(`Click (izquierda) en ${label}`); await sleep(200); return true;
}

/* ====== “Crear” robusto ====== */
const crearSelectors = [
  'button:has-text("Crear")','a:has-text("Crear")','[role="button"]:has-text("Crear")',
  'button:has-text("Nuevo")','a:has-text("Nuevo")',
  '[aria-label="Crear"]','[title="Crear"]','[data-action="create"]','[data-command="create"]',
  '.dx-toolbar .dx-button:has(.dx-icon-add)', '.dx-button:has(.dx-icon-add)'
];
async function clickCrearRobusto(page){
  await shot(page,'crear_before.png','Pantalla antes de “Crear”');
  for(const sel of crearSelectors){
    const b = page.locator(sel).first();
    if(await b.isVisible().catch(()=>false)){
      try { await b.scrollIntoViewIfNeeded(); } catch {}
      try { await b.click({timeout:1500}); } catch { await b.click({timeout:1500, force:true}).catch(()=>{}); }
      await Promise.race([page.waitForLoadState('networkidle',{timeout:3500}).catch(()=>{}), sleep(600)]);
      logOK(`Click en "Crear" con ${sel}`);
      return true;
    }
  }
  logWARN('No se encontró "Crear" (continuamos).');
  return false;
}

/* ====== Localizador preciso para TDI (lado izquierdo, NO datebox) ====== */
function isDateLikeEl(el){
  try{
    return !!(el.closest('.dx-datebox') || el.querySelector('.dx-datebox') || el.querySelector('.dx-icon-calendar'));
  }catch{ return false; }
}
async function locateTDIHost(page){
  // 1) Fila por label “*Tipo de documento”/“Tipo de documento”
  const label = page.locator('xpath=//*[normalize-space(.)="*Tipo de documento" or normalize-space(.)="Tipo de documento"]').first();
  if (await label.isVisible().catch(()=>false)) {
    let row = label.locator('xpath=ancestor::tr[1]').first();
    if (!(await row.isVisible().catch(()=>false))) {
      row = label.locator('xpath=ancestor::*[self::div or self::td][1]').first();
    }
    if (await row.isVisible().catch(()=>false)) {
      try{
        const html = await row.evaluate(el => el.outerHTML).catch(()=> '');
        R.blobs.rowHtml = (html||'').replace(/[<]/g,'&lt;');
      }catch{}
      // El host correcto (lookup/selectbox/combobox) dentro de la fila
      const hostInRow = row.locator(
        '.dx-lookup:not(.dx-datebox), .dx-selectbox:not(.dx-datebox), [role="combobox"]:not(.dx-datebox)'
      ).first();
      if (await hostInRow.isVisible().catch(()=>false)) {
        // validar que no sea fecha
        const isDate = await hostInRow.evaluate(isDateLikeEl).catch(()=>false);
        if (!isDate) return hostInRow;
      }
    }
  }

  // 2) Por texto “Tipo de Identificación”
  const byText = page.locator('xpath=//*[normalize-space(.)="Tipo de Identificación"]').first();
  if (await byText.isVisible().catch(()=>false)) {
    const hostByText = byText.locator('xpath=ancestor::*[contains(@class,"dx-lookup") or contains(@class,"dx-selectbox") or @role="combobox"][1]').first();
    if (await hostByText.isVisible().catch(()=>false)) {
      const isDate = await hostByText.evaluate(isDateLikeEl).catch(()=>false);
      if (!isDate) return hostByText;
    }
  }

  // 3) Heurística: mitad izquierda, el combobox visible más cercano verticalmente al label
  const vp = page.viewportSize?.() ?? {width:1200, height:800};
  const leftHalf = vp.width/2;
  const candidates = page.locator('.dx-lookup:not(.dx-datebox), .dx-selectbox:not(.dx-datebox), [role="combobox"]:not(.dx-datebox)');
  const n = await candidates.count().catch(()=>0);
  if (n){
    let best=null, bestDy=Infinity;
    let labelY=null;
    if (await label.isVisible().catch(()=>false)) {
      const lb = await label.boundingBox().catch(()=>null);
      if (lb) labelY = lb.y + lb.height/2;
    }
    for (let i=0;i<Math.min(n,16);i++){
      const el = candidates.nth(i);
      if (!(await el.isVisible().catch(()=>false))) continue;
      const bx = await el.boundingBox().catch(()=>null);
      if (!bx) continue;
      if (bx.x > leftHalf) continue; // evitamos controles del lado derecho (fecha/código)
      const isDate = await el.evaluate(isDateLikeEl).catch(()=>false);
      if (isDate) continue;
      const dy = (labelY!=null) ? Math.abs((bx.y + bx.height/2) - labelY) : bx.y;
      if (dy < bestDy){ bestDy = dy; best = el; }
    }
    if (best) return best.first();
  }

  return null;
}

/* ====== Abrir selector (clic preciso al “Tipo de documento” izquierdo) ====== */
async function openTipoIdentificacion_ByRow(page){
  logINFO('Abriendo selector "Tipo de Identificación" (por fila/arrow)…');

  const host = await locateTDIHost(page);
  if (!host) {
    logWARN('No se encontró la fila/host de “Tipo de documento” (lado izquierdo).');
    await shot(page,'selector_tdi_fail.png','No se encontró host del selector');
    return { opened:false, host:null };
  }

  try{
    const html = await host.evaluate(el => el.outerHTML).catch(()=> '');
    R.blobs.hostHtml = (html||'').replace(/[<]/g,'&lt;');
  }catch{}

  const combo = host.locator('[role="combobox"]').first();
  const arrow = host.locator('.dx-lookup-arrow, .dx-dropdowneditor-icon, .dx-dropdowneditor-button, .k-select, .dx-icon-overflow').first();

  async function isReallyOpenDumpOverlay(){
    const ctrlBox = await (combo.isVisible().catch(()=>false) ? combo.boundingBox().catch(()=>null) : host.boundingBox().catch(()=>null));
    const overlays = page.locator('.dx-overlay-wrapper:visible, .dx-popup-content:visible, .dx-dropdowneditor-overlay:visible, .k-animation-container:visible, .k-popup:visible, ul[role="listbox"]:visible, .dx-list:visible');
    const n = await overlays.count().catch(()=>0);
    if (!n || !ctrlBox) return false;
    for (let i=0;i<n;i++){
      const el = overlays.nth(i);
      const box = await el.boundingBox().catch(()=>null);
      if (!box) continue;
      const dy = Math.abs((box.y) - (ctrlBox.y + ctrlBox.height));
      const near = dy < 260;
      const overlapX = (box.x < ctrlBox.x + ctrlBox.width) && (box.x + box.width > ctrlBox.x);
      if (near && overlapX) {
        try{
          const html = await el.evaluate(n=>n.outerHTML).catch(()=> '');
          R.blobs.overlayHtml = (html||'').replace(/[<]/g,'&lt;');
        }catch{}
        return true;
      }
    }
    return false;
  }

  // 1) Flecha del propio control IZQUIERDO
  try { await host.scrollIntoViewIfNeeded().catch(()=>{}); } catch {}
  if (await arrow.isVisible().catch(()=>false)) {
    await arrow.click({timeout:1500}).catch(()=>{});
    await sleep(220);
    if (await isReallyOpenDumpOverlay()) { logOK('Selector abierto con clic en flecha (izquierda).'); await shot(page,'selector_tdi_ok.png','Selector abierto'); return { opened:true, host }; }
  }

  // 2) Clic en el campo (role=combobox) del IZQUIERDO
  if (await combo.isVisible().catch(()=>false)) {
    await combo.click({timeout:1500}).catch(()=>{});
    await sleep(180);
    if (await isReallyOpenDumpOverlay()) { logOK('Selector abierto con clic en el campo (izquierda).'); await shot(page,'selector_tdi_ok.png','Selector abierto'); return { opened:true, host }; }
  }

  // 3) Clic por coordenadas en el borde derecho del control IZQUIERDO (sin tocar calendario)
  const box = await (await (combo.isVisible().catch(()=>false) ? combo : host)).boundingBox().catch(()=>null);
  if (box) {
    const x = box.x + box.width - 12; // aprox. sobre la flecha del combo
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(200);
    if (await isReallyOpenDumpOverlay()) { logOK('Selector abierto con clic por coordenadas (izquierda).'); await shot(page,'selector_tdi_ok.png','Selector abierto'); return { opened:true, host }; }
  }

  // 4) Wrapper del host
  await host.click({timeout:1500}).catch(()=>{});
  await sleep(180);
  if (await isReallyOpenDumpOverlay()) { logOK('Selector abierto con clic en wrapper (izquierda).'); await shot(page,'selector_tdi_ok.png','Selector abierto'); return { opened:true, host }; }

  // 5) Alt+↓
  try { if (await combo.isVisible().catch(()=>false)) await combo.focus(); else await host.focus(); } catch {}
  try { await page.keyboard.down('Alt'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Alt'); } catch {}
  await sleep(200);
  if (await isReallyOpenDumpOverlay()) { logOK('Selector abierto con Alt+↓ (izquierda).'); await shot(page,'selector_tdi_ok.png','Selector abierto'); return { opened:true, host }; }

  // 6) Fallback duro pedido: si nada funcionó, hacer clic en cualquier combobox visible de la MITAD IZQUIERDA
  const vp = page.viewportSize?.() ?? {width:1200, height:800};
  const leftHalf = vp.width/2;
  const leftCombos = page.locator('[role="combobox"]:visible');
  const m = await leftCombos.count().catch(()=>0);
  for (let i=0;i<m;i++){
    const c = leftCombos.nth(i);
    const bx = await c.boundingBox().catch(()=>null);
    if (!bx || bx.x > leftHalf) continue;
    // evitar datebox
    const isDate = await c.evaluate(isDateLikeEl).catch(()=>false);
    if (isDate) continue;
    await c.click({timeout:1200}).catch(()=>{});
    await sleep(200);
    if (await isReallyOpenDumpOverlay()) { logOK('Selector abierto en fallback por combobox (izquierda).'); await shot(page,'selector_tdi_ok.png','Selector abierto'); return { opened:true, host:c }; }
  }

  logWARN('No se logró abrir el selector (TDI) en el lado izquierdo.');
  await shot(page,'selector_tdi_fail.png','Fallo al abrir selector');
  return { opened:false, host };
}

/* ====== Seleccionar opción ====== */
function escapeRegex(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
async function selectOpcionTDI(page, textoOpcion){
  if (!textoOpcion) { logINFO('TDI_OPTION no definido; no se seleccionará opción.'); return false; }
  logINFO(`Seleccionando opción TDI: "${textoOpcion}"…`);

  // ⚡ Atajo solicitado por ti: combobox #2 + texto exacto
  try {
    await page.getByRole('combobox').nth(1).click({ timeout: 1500 });
    await page.getByText(textoOpcion, { exact: true }).click({ timeout: 3000 });
    await sleep(200);
    logOK(`Opción seleccionada por atajo directo: ${textoOpcion}`);
    await shot(page,'selector_tdi_selected.png','Opción seleccionada (atajo directo)');
    return true;
  } catch {}

  // 1) ARIA role=option exacta
  let opt = page.getByRole('option', { name: new RegExp(`^\\s*${escapeRegex(textoOpcion)}\\s*$`, 'i') }).first();
  if (await opt.isVisible().catch(()=>false)) {
    await opt.click({ timeout: 3000 }).catch(()=>{});
    await sleep(200);
    logOK(`Opción encontrada por role=option: ${textoOpcion}`);
    await shot(page,'selector_tdi_selected.png','Opción seleccionada (role=option)');
    return true;
  }
  // 2) DevExtreme
  const dx = page.locator('.dx-overlay-content .dx-list .dx-list-item, .dx-popup-content .dx-list .dx-list-item')
                 .filter({ hasText: new RegExp(escapeRegex(textoOpcion), 'i') }).first();
  if (await dx.isVisible().catch(()=>false)) {
    await dx.click({ timeout: 3000 }).catch(()=>{});
    await sleep(200);
    logOK(`Opción encontrada (DevExtreme .dx-list-item): ${textoOpcion}`);
    await shot(page,'selector_tdi_selected.png','Opción seleccionada (DevExtreme)');
    return true;
  }
  // 3) Kendo
  const kdo = page.locator('.k-animation-container .k-list .k-list-item, .k-popup .k-list .k-list-item')
                 .filter({ hasText: new RegExp(escapeRegex(textoOpcion), 'i') }).first();
  if (await kdo.isVisible().catch(()=>false)) {
    await kdo.click({ timeout: 3000 }).catch(()=>{});
    await sleep(200);
    logOK(`Opción encontrada (Kendo .k-list-item): ${textoOpcion}`);
    await shot(page,'selector_tdi_selected.png','Opción seleccionada (Kendo)');
    return true;
  }
  // 4) Fallback genérico
  const fb = page.locator('ul[role="listbox"] li, [role="listbox"] [role="option"], .dx-item, .dx-list-item')
                 .filter({ hasText: new RegExp(escapeRegex(textoOpcion), 'i') }).first();
  if (await fb.isVisible().catch(()=>false)) {
    await fb.click({ timeout: 3000 }).catch(()=>{});
    await sleep(200);
    logOK(`Opción encontrada (fallback): ${textoOpcion}`);
    await shot(page,'selector_tdi_selected.png','Opción seleccionada (fallback)');
    return true;
  }
  logWARN(`No se encontró la opción TDI: ${textoOpcion}`);
  await shot(page,'selector_tdi_option_not_found.png','No se encontró la opción solicitada');
  return false;
}

/* ====== Verificar valor aplicado ====== */
async function assertValorAplicadoTDI(page, host, esperado){
  try{
    const valor = await page.evaluate((el)=>{
      const esc = (s)=> (s??'').toString().trim();
      const getDevExtreme = (root)=>{
        if (!root) return '';
        const v1 = root.querySelector('.dx-lookup-field .dx-lookup-value');
        if (v1) return esc(v1.textContent);
        const inp = root.querySelector('input[role="combobox"]');
        if (inp) return esc(inp.value || inp.getAttribute('value') || inp.textContent);
        const field = root.querySelector('.dx-lookup-field');
        if (field) return esc(field.textContent);
        return '';
      };
      const getKendo = (root)=>{
        if (!root) return '';
        const v = root.querySelector('.k-input-value-text,.k-input-inner');
        if (v) return esc(v.textContent);
        const inp = root.querySelector('input');
        if (inp) return esc(inp.value || inp.getAttribute('value') || inp.textContent);
        return '';
      };
      return getDevExtreme(el) || getKendo(el);
    }, await host.elementHandle());

    const got = (valor||'').trim();
    R.blobs.valorFinalTDI = `Esperado: ${esperado||'(no configurado)'}\nObtenido: ${got||'(vacío)'}`;
    if (esperado) {
      if (!got) { logWARN('El control TDI quedó vacío tras la selección.'); return false; }
      if (new RegExp(`^\\s*${escapeRegex(esperado)}\\s*$`, 'i').test(got)) { logOK(`Valor TDI aplicado: "${got}"`); return true; }
      logWARN(`El valor en el control no coincide. Obtenido: "${got}" / Esperado: "${esperado}"`);
      return false;
    } else {
      logINFO(`Valor TDI obtenido: "${got}"`);
      return !!got;
    }
  }catch(e){
    logWARN(`No se pudo leer el valor aplicado en TDI: ${e?.message||e}`);
    return false;
  }
}

/* ================== Normalizador de URL (.env) ================== */
function normalizeUrl(raw) {
  if (!raw) return '';
  let u = String(raw).trim().replace(/^['"]+|['"]+$/g, '');   // quita comillas externas
  u = u.replace(/["']/g, '');                                // quita comillas sueltas internas
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u;           // asegura protocolo
  try { new URL(u); } catch { return ''; }                   // valida
  return u;
}

/* ================== Flujo principal ================== */
module.exports = async function globalSetup(){
  const urlRaw  = process.env.URL;
  const url     = normalizeUrl(urlRaw);
  if (!url) throw new Error('❌ URL inválida en .env (revisa comillas y protocolo)');
  if (!process.env.USER || !process.env.PASS) throw new Error('❌ Faltan USER o PASS en .env');
  const user = process.env.USER;
  const pass = process.env.PASS;

  const TDI_OPTION = process.env.TDI_OPTION || 'CEDULA DE CIUDADANIA'; // valor por defecto pedido
  const headless = String(process.env.HEADLESS||'false').toLowerCase()==='true';
  const slowMo   = Number(process.env.SLOWMO||130);

  const browser = await chromium.launch({ headless, slowMo });
  const context = await browser.newContext();
  const page = await context.newPage();

  try{
    logINFO('Abriendo página…');
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });

    await clickWhenReady(page.getByPlaceholder('Usuario'),'Campo Usuario');
    await page.getByPlaceholder('Usuario').fill(user);
    await clickWhenReady(page.getByPlaceholder('Contraseña'),'Campo Contraseña');
    await page.getByPlaceholder('Contraseña').fill(pass);
    await clickWhenReady(page.getByRole('button',{name:/Ingresar/i}),'Clic Ingresar');

    await Promise.race([ page.waitForLoadState('networkidle',{timeout:12000}).catch(()=>{}), sleep(2200) ]);
    await closeTopModalIfAny(page);
    await closeBottomBannerIfAny(page);

    const ruta=['Compras e Inventarios','Proveedores'];
    const sideSels=['.sidebar-menu','.sidebar','aside','nav[role="navigation"]','.navigation','.k-menu','.k-panelbar'];
    let done=false;
    for(const s of sideSels){
      const area=page.locator(s).first();
      if(await area.isVisible().catch(()=>false)){
        for(const lbl of ruta){ await clickLeftMenu(area,page,lbl).catch(()=>{}); await sleep(350); }
        done=true; break;
      }
    }
    if(!done){ for(const lbl of ruta){ await clickLeftMenu(page,page,lbl).catch(()=>{}); await sleep(350); } }

    await clickCrearRobusto(page);

    await Promise.race([
      page.waitForSelector('.dx-form, form, .dx-lookup, .dx-selectbox, [role="combobox"]',{timeout:10000}).catch(()=>{}),
      page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{})
    ]);

    // ---------- ABRIR SELECTOR (lado izquierdo) ----------
    const { opened, host } = await openTipoIdentificacion_ByRow(page);

    // ---------- SELECCIONAR OPCIÓN ----------
    // Primero: tu atajo directo (aunque ya hayamos abierto el selector por la fila, no hace daño reintentar sobre la lista)
    let selOK = false;
    try {
      await page.getByRole('combobox').nth(1).click({ timeout: 1500 });
      await page.getByText(TDI_OPTION, { exact: true }).click({ timeout: 3000 });
      await sleep(200);
      logOK(`(Atajo) Selección directa aplicada: ${TDI_OPTION}`);
      await shot(page,'selector_tdi_selected.png','Opción seleccionada (atajo directo en flujo principal)');
      selOK = true;
    } catch {}

    // Si el atajo falló, usa el flujo robusto
    if (!selOK && opened && host) {
      selOK = await selectOpcionTDI(page, TDI_OPTION);
    }

    // ---------- VALIDAR VALOR APLICADO ----------
    if (host) {
      await page.waitForLoadState('networkidle',{timeout:6000}).catch(()=>{});
      await sleep(300);
      await assertValorAplicadoTDI(page, host, selOK ? TDI_OPTION : '');
    }

    await page.waitForLoadState('networkidle',{timeout:6000}).catch(()=>{});
    await shot(page,'global_setup_ok.png','Estado final (OK)');
    await context.storageState({ path:'storage/auth.json' }).catch(()=>{});
    logOK('Sesión guardada en storage/auth.json');
  }catch(e){
    logERR(`Error: ${e?.message || e}`);
    await shot(page,'global_setup_error.png','Estado final con error');
    try{ if(!page.isClosed()){ const html=await page.content(); fs.writeFileSync('global_setup_error.html', html,'utf8'); } }catch{}
    throw e;
  }finally{
    saveReport();
    try{ await browser.close(); }catch{}
  }
};
