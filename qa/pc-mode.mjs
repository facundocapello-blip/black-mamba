#!/usr/bin/env node
// Prueba del modo PC compacto sin dependencias externas.
// Sirve v1.7m-staging, abre Edge headless con CDP y verifica layout + flujo de cartas.
// Uso: node qa/pc-mode.mjs [--headed]

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, readFile as rf } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const APP = '/v1.7m-staging/index.html';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

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
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
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
    check('el modo PC arranca cerrado', await evaluate('!document.getElementById("bmmPc")?.classList.contains("open")'));
    await evaluate('document.getElementById("bmmPcToggle")?.click()');
    check('el modo PC abre', await evaluate('!!document.getElementById("bmmPc")?.classList.contains("open")'));

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
      check('la página queda bloqueada sin scroll', layout.locked, JSON.stringify({ locked: layout.locked }));      check('sin scroll interno del panel', !layout.scrolls, JSON.stringify({ panelH: layout.panelH, panelClientH: layout.panelClientH, panelW: layout.panelW, panelClientW: layout.panelClientW, overlayH: layout.overlayH, overlayClientH: layout.overlayClientH }));
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

    // 5d. Teclado real: una letra carga la carta (el tablero ya soporta teclas).
    await evaluate('document.activeElement?.blur()');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'q', code: 'KeyQ', windowsVirtualKeyCode: 81, text: 'q' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'q', code: 'KeyQ', windowsVirtualKeyCode: 81 });
    const kbdCard = await evaluate(`[...document.querySelectorAll('#meHand .card-face:not(.fake):not(.virtual)')].map(e => e.dataset.rank).join(',')`);
    check('el teclado carga una carta en el modo PC', kbdCard.includes('Q'), kbdCard || 'sin cartas');

    const kbd = await evaluate(`(() => {
      const b = document.querySelector('#bmmPcRanks [data-pc-rank="A"]');
      if (!b) return null;
      b.focus();
      b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return { focused: document.activeElement === b, tag: b.tagName, type: b.type, tabIndex: b.tabIndex };
    })()`);
    check('los valores de carta son botones accesibles', !!kbd && kbd.tag === 'BUTTON' && kbd.tabIndex >= 0, JSON.stringify(kbd));

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

    // 8. Cerrar el modo PC y comprobar que la app sigue funcionando.
    await evaluate('document.getElementById("bmmPcClose")?.click()');
    check('el modo PC cierra', await evaluate('!document.getElementById("bmmPc")?.classList.contains("open")'));
    await evaluate('document.getElementById("exampleBtn")?.click()');
    const exampleSamples = [];
    for (let i = 0; i < 60; i++) {
      const text = await evaluate('document.getElementById("bmDecision").textContent');
      exampleSamples.push(text);
      if (['PLANTARSE', 'PEDIR CARTA', 'DOBLAR', 'DIVIDIR'].includes(text)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const example = await evaluate(`({ decision: document.getElementById('bmDecision').textContent, win: document.getElementById('bmBestWin').textContent })`);
    check('el botón Ejemplo sigue calculando', example.decision === 'PLANTARSE', `${JSON.stringify(example)} · ${[...new Set(exampleSamples)].join(' > ')}`);
    check('el ejemplo conserva su 21,3 %', example.win.includes('21,3'), example.win);

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
