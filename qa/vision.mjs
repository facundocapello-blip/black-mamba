#!/usr/bin/env node
// Prueba del lector de la mesa «Blackjack Ilimitado» y de la lectura en vivo.
// Usa los recortes de qa/fixtures/ilimitado (sólo globo y cartas, sin datos personales).
// Uso: node qa/vision.mjs [--headed]

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
  const profile = await mkdtemp(path.join(tmpdir(), 'bm-vision-'));
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

    const expected = JSON.parse(await readFile(path.join(ROOT, 'qa', 'fixtures', 'ilimitado', 'esperado.json'), 'utf8'));
    await evaluate(`window.__img = async (file) => {
      const im = new Image(); im.src = '/qa/fixtures/ilimitado/' + file; await im.decode();
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
      return x.getImageData(0, 0, c.width, c.height);
    }; true`);
    check('el lector y la lectura en vivo están cargados', await evaluate(`typeof BMV === 'object' && typeof BMLive === 'object' && !!document.getElementById('bmmPcLive')`));

    // 1. Cada recorte: cantidad de cartas, valores y veredicto (segura / dudosa).
    for (const fx of expected) {
      const r = await evaluate(`(async () => { const r = BMV.read(await __img(${JSON.stringify(fx.file)})); const j = r.ok ? BMLive.judge(r) : null;
        return { ok: r.ok, reason: r.reason, n: r.player.length, p: r.player.map(c => c.label), d: r.dealer.map(c => c.label), total: r.total, doubt: j ? j.doubt : null, scale: r.scale }; })()`);
      const wantP = fx.jugador.filter(Boolean), gotP = r.p.slice(0, wantP.length);
      const name = `${fx.file} · ${fx.jugador.map((x) => x || '?').join(' + ')} contra ${(fx.crupier || []).join(' + ') || '—'} (${fx.escala}px)`;
      check(`${name}: cuenta ${fx.jugador.length} cartas`, r.ok && r.n === fx.jugador.length, JSON.stringify(r));
      check(`${name}: lee tus cartas`, JSON.stringify(gotP) === JSON.stringify(wantP), JSON.stringify(r.p));
      if (fx.crupier) check(`${name}: lee al crupier`, JSON.stringify(r.d) === JSON.stringify(fx.crupier), JSON.stringify(r.d));
      if (fx.tapada) check(`${name}: carta tapada → dudosa`, r.doubt && r.doubt.length > 0, JSON.stringify(r.doubt));
      else if (fx.crupier && fx.crupier.length === 1) check(`${name}: lectura segura`, r.doubt && r.doubt.length === 0, JSON.stringify(r.doubt));
      if (!fx.totalBlando && r.total != null) check(`${name}: total del globo = ${fx.total}`, r.total === fx.total, String(r.total));
    }

    // 2. Sin mesa en la imagen no inventa nada.
    const blank = await evaluate(`(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 500; const x = c.getContext('2d'); x.fillStyle = '#5c7a96'; x.fillRect(0, 0, 800, 500); const r = BMV.read(x.getImageData(0, 0, 800, 500)); return { ok: r.ok, reason: r.reason }; })()`);
    check('imagen sin mesa → no lee', blank.ok === false && blank.reason === 'sin-globo', JSON.stringify(blank));

    // 3. Lectura en vivo: una mano completa alimentada cuadro por cuadro.
    const pick = (p, d) => expected.find((f) => !f.tapada && JSON.stringify(f.jugador) === JSON.stringify(p) && JSON.stringify(f.crupier) === JSON.stringify(d)).file;
    const feed = (file) => evaluate(`(async () => { const s = BMLive.feedImage(await __img(${JSON.stringify(file)})); return { kind: s.kind, text: s.text, ...BMApp.peek(), decision: document.getElementById('bmDecision').textContent }; })()`);
    const empty = () => evaluate(`(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#5c7a96'; x.fillRect(0, 0, 600, 400); const s = BMLive.feedImage(x.getImageData(0, 0, 600, 400)); return { kind: s.kind, text: s.text, ...BMApp.peek() }; })()`);
    await evaluate(`(() => { document.getElementById('settingsBtn').click(); document.getElementById('presetIlimitado').click(); document.getElementById('saveSettings').click(); document.getElementById('bmmPcToggle').click(); BMLive.reset(); return true; })()`);
    const rules = (await evaluate('BMApp.peek()')).settings;
    check('las reglas de la mesa quedan guardadas', rules.decks === 8 && rules.peekAceOnly && rules.charlie6 && !rules.h17 && !rules.doubleAfterSplit, JSON.stringify(rules));
    const q1 = pick(['Q'], ['7']), q2 = pick(['Q', '6'], ['7']);
    let s = await feed(q1);
    check('un solo cuadro no alcanza para cargar', s.me.length === 0 && s.dealer.length === 0, JSON.stringify(s));
    s = await feed(q1);
    check('dos cuadros iguales cargan Q contra 7', s.kind === 'ok' && s.me.join() === 'Q' && s.dealer.join() === '7', JSON.stringify(s));
    s = await feed(q2); s = await feed(q2);
    check('la segunda carta se agrega sola', s.me.join() === 'Q,6' && s.dealer.join() === '7' && s.spent === 0, JSON.stringify(s));
    check('la jugada aparece sin tocar nada', ['PEDIR CARTA', 'PLANTARSE'].includes(s.decision), s.decision);
    check('el estado avisa lo leído y que verificó el total', /Leído: Q \+ 6 contra 7/.test(s.text) && /total verificado/.test(s.text), s.text);
    const pcShown = await evaluate(`({ d: document.getElementById('bmmPcDecision').textContent, live: document.getElementById('bmmPcLiveStatus').textContent, scroll: document.getElementById('bmmPcBody').scrollHeight <= document.getElementById('bmmPcBody').clientHeight + 1, fits: document.querySelector('#bmmPc .bmpc-foot').getBoundingClientRect().bottom <= window.innerHeight + 1 })`);
    check('el modo PC muestra la jugada y el estado sin scroll', pcShown.d === s.decision && /Leído/.test(pcShown.live) && pcShown.scroll && pcShown.fits, JSON.stringify(pcShown));
    const slots = await evaluate(`[...document.querySelectorAll('#bmmPc .bmpc-slot, #bmmPc [data-pc-slot]')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()).join(' | ')`);
    check('las casillas del modo PC muestran las cartas leídas', /Q/.test(slots) && /6/.test(slots) && /7/.test(slots), slots);
    s = await feed(q2);
    check('repetir el mismo cuadro no duplica cartas', s.me.join() === 'Q,6' && s.dealer.join() === '7', JSON.stringify(s));

    // 4. Carta tapada: avisa y no carga nada nuevo.
    const covered = expected.find((f) => f.tapada && f.crupier && f.crupier.length === 1);
    if (covered) {
      s = await feed(covered.file); s = await feed(covered.file);
      check('carta tapada → «Dudosa» y la mano queda como estaba', s.kind === 'doubt' && /Dudosa/.test(s.text) && s.me.join() === 'Q,6', JSON.stringify(s));
    }

    // 5. La mesa se vacía: cierra la mano y guarda las cartas en el zapato.
    for (let i = 0; i < 3; i++) s = await empty();
    check('tres cuadros vacíos todavía no cierran la mano', s.me.join() === 'Q,6', JSON.stringify(s));
    s = await empty();
    check('al cuarto cuadro vacío arranca mano nueva', s.me.length === 0 && s.dealer.length === 0 && s.spent === 3, JSON.stringify(s));

    // 6. Mano nueva distinta sin pausa: la anterior pasa al zapato.
    const a = pick(['8'], ['2']), b = pick(['2', '6'], ['J']);
    await feed(a); s = await feed(a);
    check('lee la mano siguiente (8 contra 2)', s.me.join() === '8' && s.dealer.join() === '2', JSON.stringify(s));
    await feed(b); s = await feed(b);
    check('si cambian las cartas, es otra mano', s.me.join() === '2,6' && s.dealer.join() === 'J' && s.spent === 5, JSON.stringify(s));

    // 7. El total de la mesa manda: si no coincide con lo leído, es dudosa.
    const fake = await evaluate(`BMLive.judge({ checks: [], total: 15, player: [{ label: '8', score: 1, margin: 1 }, { label: 'Q', score: 1, margin: 1 }], dealer: [{ label: '2', score: 1, margin: 1 }] }).doubt`);
    check('suma distinta al globo → dudosa', fake.length === 1 && /mesa dice 15/.test(fake[0]), JSON.stringify(fake));
    const weak = await evaluate(`BMLive.judge({ checks: [], total: null, player: [{ label: '8', score: 0.6, margin: 0.3 }], dealer: [{ label: '2', score: 1, margin: 0.05 }] }).doubt`);
    check('parecido bajo o empate entre valores → dudosa', weak.length === 2, JSON.stringify(weak));

    // 8. Reglas de la mesa desde Ajustes.
    const preset = await evaluate(`(() => { document.getElementById('settingsBtn').click(); document.getElementById('presetIlimitado').click(); const v = { decks: document.getElementById('decks').value, ace: document.getElementById('peekAceOnly').checked, six: document.getElementById('charlie6').checked, h17: document.getElementById('h17').checked }; document.getElementById('settingsCancel').click(); return v; })()`);
    check('el botón de reglas completa 8 mazos, peek con As y seis cartas', preset.decks === '8' && preset.ace && preset.six && !preset.h17, JSON.stringify(preset));

    await new Promise((r) => setTimeout(r, 200));
    check('sin errores de página registrados', errors.length === 0, errors.join(' | '));

    close();
  } finally {
    edge.kill('SIGKILL');
    server.close();
  }

  console.log(failures.length ? `\nVISIÓN FALLA (${failures.length})` : '\nVISIÓN OK');
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
