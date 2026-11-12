#!/usr/bin/env node
// Prueba del modo PC compacto sin dependencias externas.
// Sirve v1.7m-staging, abre Edge headless con CDP y verifica layout + flujo de cartas.
// Uso: node qa/pc-mode.mjs [--headed]

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const APP = '/v1.7m-staging/index.html';
const HEADED = process.argv.includes('--headed');
const EDGE = [process.env.EDGE_PATH, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].filter(Boolean).find((p) => existsSync(p));
if (!EDGE) { console.error('No encontré Edge. Definí EDGE_PATH con la ruta a msedge.exe.'); process.exit(1); }

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
}

function serve() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function waitForFile(file, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { return await readFile(file, 'utf8'); } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error(`No apareció ${file}`);
}

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    // Los confirm() del tablero (ejemplo, zapato) no deben colgar la prueba.
    if (msg.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
  return { send, close: () => ws.close(), errors };
}

async function main() {
  const server = await serve();
  const port = server.address().port;
  const profile = await mkdtemp(path.join(tmpdir(), 'bm-pc-'));
  const edge = spawn(EDGE, [
    ...(HEADED ? [] : ['--headless=new']), '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const [debugPort] = (await waitForFile(path.join(profile, 'DevToolsActivePort'))).trim().split(/\r?\n/);
    const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`http://127.0.0.1:${port}${APP}`)}`, { method: 'PUT' })).json();
    const { send, close, errors } = await cdp(target.webSocketDebuggerUrl);

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 683, height: 768, deviceScaleFactor: 1, mobile: false });

    const evaluate = async (expression) => {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
      return res.result.value;
    };

    for (let i = 0; i < 100; i++) {
      const ready = await evaluate(`location.pathname.includes('/v1.7m-staging/') && document.readyState === "complete"`);
      if (ready) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await send('Log.enable').catch(() => {});

    // 1. La vista compacta existe y se abre.
    const headerFit = await evaluate(`({
      noHorizontal: document.documentElement.scrollWidth <= window.innerWidth + 1,
      toggleVisible: (() => { const b = document.getElementById('bmmPcToggle'); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.right <= window.innerWidth + 1; })(),
    })`);
    check('el botón PC entra en la barra a 683 px', headerFit.toggleVisible && headerFit.noHorizontal, JSON.stringify(headerFit));
    check('existe el botón de modo PC', await evaluate('!!document.getElementById("bmmPcToggle")'));
    check('el panel móvil arranca cerrado en escritorio', await evaluate('!document.getElementById("bmmOverlay")?.classList.contains("open")'));
    const toggleHit = await evaluate(`(() => {
      const b = document.getElementById('bmmPcToggle');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return el === b || b.contains(el);
    })()`);
    check('el botón PC es clickeable al abrir', toggleHit === true, String(toggleHit));
    check('el modo PC arranca cerrado', await evaluate('!document.getElementById("bmmPc")?.classList.contains("open")'));
    await evaluate(`(() => { const h = document.getElementById('hypoCheck'); h.checked = true; h.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('bmmPcToggle').focus(); document.getElementById('bmmPcToggle').click(); })()`);
    check('el modo PC abre', await evaluate('!!document.getElementById("bmmPc")?.classList.contains("open")'));
    check('al abrir, el foco queda dentro del modo PC', await evaluate('document.getElementById("bmmPc")?.contains(document.activeElement)') === true);
    check('la simulación se desactiva al abrir', await evaluate('!document.getElementById("hypoCheck").checked'));
    await evaluate('document.getElementById("bmmPcNewHand").focus()');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    check('Tab permanece en el modo PC', await evaluate('document.getElementById("bmmPc").contains(document.activeElement)'));
    await evaluate('document.getElementById("bmmPcClose").focus()');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
    check('Shift+Tab permanece en el modo PC', await evaluate('document.getElementById("bmmPc").contains(document.activeElement)'));

    // 2. Sin scroll a 683 × 768, ni de página ni del panel.
    const layout = await evaluate(`(() => {
      const pc = document.getElementById('bmmPc');
      const panel = document.getElementById('bmmPcBody');
      if (!pc || !panel) return null;
      window.scrollTo(0, 5000);
      const locked = getComputedStyle(document.body).overflow === 'hidden' && getComputedStyle(document.documentElement).overflow === 'hidden';
      window.scrollTo(0, 0);
      return {
        locked,
        overlayH: pc.scrollHeight, overlayClientH: pc.clientHeight,
        overlayW: pc.scrollWidth, overlayClientW: pc.clientWidth,
        panelH: panel.scrollHeight, panelClientH: panel.clientHeight,
        panelW: panel.scrollWidth, panelClientW: panel.clientWidth,
        scrolls: panel.scrollHeight > panel.clientHeight + 1 || panel.scrollWidth > panel.clientWidth + 1 || pc.scrollHeight > pc.clientHeight + 1 || pc.scrollWidth > pc.clientWidth + 1,
        ranks: document.querySelectorAll('#bmmPcRanks [data-pc-rank]').length,
      };
    })()`);
    check('la vista compacta está montada', layout !== null);
    if (layout) {
      check('la página queda bloqueada sin scroll', layout.locked, JSON.stringify({ locked: layout.locked }));
      check('sin scroll interno del panel', !layout.scrolls, JSON.stringify({ panelH: layout.panelH, panelClientH: layout.panelClientH, panelW: layout.panelW, panelClientW: layout.panelClientW, overlayH: layout.overlayH, overlayClientH: layout.overlayClientH }));
      check('13 valores de carta disponibles', layout.ranks === 13, `encontrados: ${layout.ranks}`);
    }

    // 2b. Tamaño chico: los controles no se ocultan ni se cortan en horizontal.
    await send('Emulation.setDeviceMetricsOverride', { width: 500, height: 700, deviceScaleFactor: 1, mobile: false });
    const small = await evaluate(`(() => {
      const inView = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; };
      const ranks = [...document.querySelectorAll('#bmmPcRanks [data-pc-rank]')];
      return {
        close: inView(document.getElementById('bmmPcClose')),
        newHand: inView(document.getElementById('bmmPcNewHand')),
        visibles: ranks.filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length,
        horizontal: document.getElementById('bmmPc').scrollWidth > innerWidth + 1,
      };
    })()`);
    check('a 500 × 700 el cierre sigue visible', small.close, JSON.stringify(small));
    check('a 500 × 700 la nueva mano sigue visible', small.newHand, JSON.stringify(small));
    check('a 500 × 700 las 13 cartas están presentes', small.visibles === 13, String(small.visibles));
    check('a 500 × 700 sin desborde horizontal', !small.horizontal, JSON.stringify(small));

    // Volver al tamaño objetivo para el resto de la prueba.
    await send('Emulation.setDeviceMetricsOverride', { width: 683, height: 768, deviceScaleFactor: 1, mobile: false });

    // Captura de referencia del modo PC (fuera del repo).
    if (process.env.BM_SHOT) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const { writeFile } = await import('node:fs/promises');
      await writeFile(process.env.BM_SHOT, Buffer.from(shot.data, 'base64'));
      console.log(`captura: ${process.env.BM_SHOT}`);
    }

    // 3. Carga en orden: 10 (propia), 6 (crupier), 5 (propia).
    for (const rank of ['10', '6', '5']) await evaluate(`document.querySelector('#bmmPcRanks [data-pc-rank="${rank}"]')?.click()`);
    for (let i = 0; i < 80; i++) {
      const d = await evaluate('document.getElementById("bmDecision").textContent');
      if (['PLANTARSE', 'PEDIR CARTA', 'DOBLAR', 'DIVIDIR'].includes(d)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 400));
    const afterFlow = await evaluate(`(() => ({
      me: document.querySelectorAll('#meHand .card-face:not(.fake):not(.virtual)').length,
      dealer: document.querySelectorAll('#dealerHand .card-face:not(.fake):not(.virtual)').length,
      slots: [...document.querySelectorAll('#bmmPcSlots [data-pc-slot]')].map(el => el.dataset.pcSlot + ':' + (el.dataset.rank || '')),
      decision: document.getElementById('bmDecision').textContent,
      pcDecision: document.getElementById('bmmPcDecision').textContent,
      win: document.getElementById('bmBestWin').textContent,
      pcWin: document.getElementById('bmmPcWin').textContent,
    }))()`);
    check('carga una carta propia', afterFlow.me === 2, `mano: ${afterFlow.me}`);
    check('carga la carta del crupier', afterFlow.dealer === 1, `crupier: ${afterFlow.dealer}`);
    check('las casillas muestran la mano', afterFlow.slots.slice(0, 3).join(',') === 'me0:10,dealer:6,me1:5', afterFlow.slots.join(','));
    check('hay recomendación tras la tercera carta', !!afterFlow.decision && afterFlow.decision !== 'CALCULANDO…', afterFlow.decision);
    check('la recomendación se replica en modo PC', afterFlow.pcDecision === afterFlow.decision, `${afterFlow.pcDecision} != ${afterFlow.decision}`);
    check('el porcentaje de victoria se replica', afterFlow.pcWin === afterFlow.win, `${afterFlow.pcWin} != ${afterFlow.win}`);

    if (process.env.BM_SHOT) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const { writeFile } = await import('node:fs/promises');
      const out = process.env.BM_SHOT.replace(/\.png$/, '-lleno.png');
      await writeFile(out, Buffer.from(shot.data, 'base64'));
      console.log(`captura: ${out}`);
    }

    // 4. Corregir una sola carta: tocar la casilla del crupier la vacía.
    await evaluate(`document.querySelector('#bmmPcSlots [data-pc-slot="dealer"]')?.click()`);
    const afterClear = await evaluate(`({
      dealer: document.querySelectorAll('#dealerHand .card-face:not(.fake):not(.virtual)').length,
      me: document.querySelectorAll('#meHand .card-face:not(.fake):not(.virtual)').length,
      decision: document.getElementById('bmDecision').textContent,
    })`);
    check('vaciar la casilla del crupier no toca la mano', afterClear.dealer === 0 && afterClear.me === 2, JSON.stringify(afterClear));
    check('sin crupier no hay recomendación definitiva', afterClear.decision !== 'CALCULANDO…', afterClear.decision);

    // 5. Recarga la carta del crupier y verifica que vuelve la recomendación.
    await evaluate(`document.querySelector('#bmmPcRanks [data-pc-rank="K"]')?.click()`);
    const refilled = await evaluate(`(() => ({ dealer: document.querySelectorAll('#dealerHand .card-face:not(.fake):not(.virtual)').length, decision: document.getElementById('bmDecision').textContent }))()`);
    check('se puede recargar la casilla corregida', refilled.dealer === 1, JSON.stringify(refilled));

    // 5b. Cada casilla se corrige por separado.
    await evaluate(`document.querySelector('#bmmPcSlots [data-pc-slot="me1"]')?.click()`);
    const afterMe1 = await evaluate(`({ me: [...document.querySelectorAll('#meHand .card-face:not(.fake):not(.virtual)')].map(e => e.dataset.rank).join(','), dealer: [...document.querySelectorAll('#dealerHand .card-face:not(.fake):not(.virtual)')].length })`);
    check('corregir la segunda carta no toca la primera ni el crupier', afterMe1.me === '10' && afterMe1.dealer === 1, JSON.stringify(afterMe1));
    await evaluate(`document.querySelector('#bmmPcSlots [data-pc-slot="me0"]')?.click()`);
    const afterMe0 = await evaluate(`({ me: [...document.querySelectorAll('#meHand .card-face:not(.fake):not(.virtual)')].length, dealer: [...document.querySelectorAll('#dealerHand .card-face:not(.fake):not(.virtual)')].length })`);
    check('corregir la primera carta deja el crupier intacto', afterMe0.me === 0 && afterMe0.dealer === 1, JSON.stringify(afterMe0));

    // 5c. Los valores sin cartas en el zapato quedan deshabilitados igual que en el tablero.
    const mirror = await evaluate(`(() => {
      const pairs = [...document.querySelectorAll('#bmmPcRanks [data-pc-rank]')].map((b) => [b.dataset.pcRank, b.disabled, document.querySelector('#ranks button[data-rank="' + b.dataset.pcRank + '"]')?.disabled]);
      return pairs.filter(([, pc, main]) => pc !== main).map(([r]) => r);
    })()`);
    check('el modo PC respeta la disponibilidad del zapato', mirror.length === 0, mirror.join(','));

    // 5d. Teclado real: una letra carga la carta y la casilla se repinta.
    await evaluate('document.activeElement?.blur()');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'q', code: 'KeyQ', windowsVirtualKeyCode: 81, text: 'q' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'q', code: 'KeyQ', windowsVirtualKeyCode: 81 });
    const kbdCard = await evaluate(`({
      me: [...document.querySelectorAll('#meHand .card-face:not(.fake):not(.virtual)')].map(e => e.dataset.rank).join(','),
      slot: document.querySelector('#bmmPcSlots [data-pc-slot="me0"] strong')?.textContent,
    })`);
    check('el teclado carga una carta en el modo PC', kbdCard.me.includes('Q'), kbdCard.me || 'sin cartas');
    check('el teclado repinta la casilla', kbdCard.slot === 'Q', JSON.stringify(kbdCard));

    const kbd = await evaluate(`(() => {
      const b = document.querySelector('#bmmPcRanks [data-pc-rank="A"]');
      if (!b) return null;
      b.focus();
      b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return { focused: document.activeElement === b, tag: b.tagName, type: b.type, tabIndex: b.tabIndex };
    })()`);
    check('los valores de carta son botones accesibles', !!kbd && kbd.tag === 'BUTTON' && kbd.tabIndex >= 0, JSON.stringify(kbd));

    // 6. Corregir la primera carta con dos cargas no intercambia las casillas.
    await evaluate(`document.querySelector('#bmmPcSlots [data-pc-slot="me0"]')?.click()`);
    for (const rank of ['A', '5']) await evaluate(`document.querySelector('#bmmPcRanks [data-pc-rank="${rank}"]')?.click()`);
    await evaluate(`document.querySelector('#bmmPcSlots [data-pc-slot="me0"]')?.click()`);
    await evaluate(`document.querySelector('#bmmPcRanks [data-pc-rank="7"]')?.click()`);
    const reordered = await evaluate(`({
      me: [...document.querySelectorAll('#meHand .card-face:not(.fake):not(.virtual)')].map(e => e.dataset.rank).join(','),
      dealer: [...document.querySelectorAll('#dealerHand .card-face:not(.fake):not(.virtual)')].length,
      first: document.querySelector('#bmmPcSlots [data-pc-slot="me0"] strong')?.textContent,
      second: document.querySelector('#bmmPcSlots [data-pc-slot="me1"] strong')?.textContent,
    })`);
    check('corregir la primera carta conserva el orden', reordered.me === '7,5', JSON.stringify(reordered));
    check('las casillas siguen la posición de cada carta', reordered.first === '7' && reordered.second === '5' && reordered.dealer === 1, JSON.stringify(reordered));

    // 7. Nueva mano limpia la mesa y conserva el zapato.
    const before = await evaluate(`({ spent: document.getElementById('spentCounter').textContent })`);
    await evaluate('document.getElementById("bmmPcNewHand")?.click()');
    const afterNew = await evaluate(`(() => ({
      me: document.querySelectorAll('#meHand .card-face:not(.fake):not(.virtual)').length,
      dealer: document.querySelectorAll('#dealerHand .card-face:not(.fake):not(.virtual)').length,
      spent: document.getElementById('spentCounter').textContent,
      slots: [...document.querySelectorAll('#bmmPcSlots [data-pc-slot]')].map(el => el.dataset.rank || ''),
    }))()`);
    check('nueva mano vacía la mesa', afterNew.me === 0 && afterNew.dealer === 0, JSON.stringify(afterNew));
    check('nueva mano conserva las cartas gastadas', Number(afterNew.spent) > Number(before.spent), `${before.spent} -> ${afterNew.spent}`);
    check('nueva mano limpia las casillas', afterNew.slots.every((v) => !v), afterNew.slots.join(','));

    // 7b. V1.8: mano completa sólo con teclado, jugada inmediata, color y guía «Si sale…».
    const key = async (k, code, vk, text) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
    };
    const pcState = () => evaluate(`({
      me: [...document.querySelectorAll('#meHand .card-face:not(.fake):not(.virtual)')].map(e => e.dataset.rank).join(','),
      dealer: [...document.querySelectorAll('#dealerHand .card-face:not(.fake):not(.virtual)')].map(e => e.dataset.rank).join(','),
      decision: document.getElementById('bmmPcDecision').textContent,
      action: document.querySelector('#bmmPc .bmpc-coach').dataset.action || '',
      next: document.getElementById('bmmPcNext').textContent,
      bg: getComputedStyle(document.querySelector('#bmmPc .bmpc-coach')).backgroundColor,
      scroll: document.getElementById('bmmPcBody').scrollHeight <= document.getElementById('bmmPcBody').clientHeight + 1,
    })`);
    await key('0', 'Digit0', 48, '0'); await key('7', 'Digit7', 55, '7'); await key('6', 'Digit6', 54, '6');
    const hitNow = await pcState(); // sin esperar: la jugada tiene que estar ya
    check('16 contra 7 con tres teclas', hitNow.me === '10,6' && hitNow.dealer === '7', JSON.stringify(hitNow));
    check('la jugada sale al instante (sin «UN MOMENTO»)', hitNow.decision === 'PEDIR CARTA', hitNow.decision);
    check('pedir se pinta de rojo', hitNow.action === 'hit' && hitNow.bg === 'rgb(122, 31, 40)', `${hitNow.action} ${hitNow.bg}`);
    check('la guía dice qué hacer con la próxima carta', hitNow.next === 'Si sale A–5 → plantate · 6–K → te pasás', hitNow.next);
    check('la guía no agrega scroll', hitNow.scroll);
    await key('Backspace', 'Backspace', 8);
    const erased = await pcState();
    check('Retroceso borra la última carta', erased.me === '10' && erased.dealer === '7' && erased.action === '' && erased.next === '', JSON.stringify(erased));
    await key('k', 'KeyK', 75, 'k');
    const standNow = await pcState();
    check('20 contra 7: plantarse en verde y sin guía', standNow.decision === 'PLANTARSE' && standNow.action === 'stand' && standNow.bg === 'rgb(15, 90, 58)' && standNow.next === '', JSON.stringify(standNow));
    await key(' ', 'Space', 32, ' ');
    const spaced = await pcState();
    check('Espacio arranca una mano nueva', spaced.me === '' && spaced.dealer === '' && spaced.action === '', JSON.stringify(spaced));
    await key('8', 'Digit8', 56, '8'); await key('6', 'Digit6', 54, '6'); await key('8', 'Digit8', 56, '8');
    const splitNow = await pcState();
    check('8+8 contra 6: dividir en azul, al instante', splitNow.decision === 'DIVIDIR' && splitNow.action === 'split' && splitNow.bg === 'rgb(23, 63, 122)', JSON.stringify(splitNow));
    await key(' ', 'Space', 32, ' ');
    await key('6', 'Digit6', 54, '6'); await key('5', 'Digit5', 53, '5'); await key('5', 'Digit5', 53, '5');
    const doubleNow = await pcState();
    check('11 contra 5: doblar en amarillo', doubleNow.decision === 'DOBLAR' && doubleNow.action === 'double' && doubleNow.bg === 'rgb(107, 82, 8)', JSON.stringify(doubleNow));
    await key(' ', 'Space', 32, ' ');
    await key('2', 'Digit2', 50, '2'); await key('0', 'Digit0', 48, '0'); await key('3', 'Digit3', 51, '3');
    const lowNow = await pcState();
    check('5 contra 10: la guía agrupa varias jugadas', lowNow.decision === 'PEDIR CARTA' && /pedí otra/.test(lowNow.next) && lowNow.scroll, JSON.stringify(lowNow));
    await send('Emulation.setDeviceMetricsOverride', { width: 500, height: 700, deviceScaleFactor: 1, mobile: false });
    const lowSmall = await pcState();
    check('a 500 × 700 la guía entra sin scroll', lowSmall.scroll && await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), JSON.stringify(lowSmall));
    await send('Emulation.setDeviceMetricsOverride', { width: 683, height: 768, deviceScaleFactor: 1, mobile: false });
    await key(' ', 'Space', 32, ' ');

    // 8. Cerrar el modo PC y comprobar que la app sigue funcionando.
    await evaluate('document.getElementById("bmmPcClose")?.click()');
    check('el modo PC cierra', await evaluate('!document.getElementById("bmmPc")?.classList.contains("open")'));
    check('al cerrar devuelve el foco al botón PC', await evaluate('document.activeElement === document.getElementById("bmmPcToggle")'));
    await evaluate('document.getElementById("exampleBtn")?.click()');
    const exampleSamples = [];
    for (let i = 0; i < 60; i++) {
      const text = await evaluate('document.getElementById("bmDecision").textContent');
      exampleSamples.push(text);
      if (['PLANTARSE', 'PEDIR CARTA', 'DOBLAR', 'DIVIDIR'].includes(text)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const example = await evaluate(`({ decision: document.getElementById('bmDecision').textContent, win: document.getElementById('bmBestWin').textContent })`);
    check('el botón Ejemplo sigue calculando', example.decision === 'PEDIR CARTA', `${JSON.stringify(example)} · ${[...new Set(exampleSamples)].join(' > ')}`);
    check('el ejemplo da 18,6 % (cálculo exacto)', example.win.includes('18,6'), example.win);

    // 9. El modo móvil sigue disponible.
    const mobileOk = await evaluate(`(() => { document.getElementById('bmmLaunch').click(); return document.getElementById('bmmOverlay').classList.contains('open'); })()`);
    check('el modo móvil sigue abriendo', mobileOk === true);

    const consoleErrors = errors.length;
    check('sin errores de página registrados', consoleErrors === 0, errors.join(' | '));

    close();
  } finally {
    edge.kill('SIGKILL');
    server.close();
  }

  console.log(failures.length ? `\nPC MODE FALLA (${failures.length})` : '\nPC MODE OK');
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
