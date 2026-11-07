#!/usr/bin/env node
// Prueba del detector de cartas sobre una captura real de Betano.
// Uso: BM_OCR_SHOT="C:\ruta\captura.png" node qa/ocr-cards.mjs
// La captura NO se versiona: se pasa por variable de entorno.
// Espera una mano A♦ + 10♣ contra un K♠ del crupier (A / K / 10).
// El orden es el de la mesa: la carta de abajo (A) se repartió primero.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const APP = '/v1.7m-staging/index.html';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SHOT = process.env.BM_OCR_SHOT;

const MIME = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

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
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
  return { send, close: () => ws.close() };
}

async function main() {
  if (!SHOT || !existsSync(SHOT)) {
    console.error('Sin prueba: definí BM_OCR_SHOT con la ruta de la captura de referencia.');
    process.exit(1);
  }

  const server = await serve();
  const port = server.address().port;
  const profile = await mkdtemp(path.join(tmpdir(), 'bm-ocr-'));
  const edge = spawn(EDGE, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const [debugPort] = (await waitForFile(path.join(profile, 'DevToolsActivePort'))).trim().split(/\r?\n/);
    const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`http://127.0.0.1:${port}${APP}`)}`, { method: 'PUT' })).json();
    const { send, close } = await cdp(target.webSocketDebuggerUrl);

    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });

    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };

    for (let i = 0; i < 60; i++) {
      if (await evaluate('location.pathname').catch(() => '')) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await new Promise((r) => setTimeout(r, 800));

    // La captura se carga por el input real de la app.
    const { root } = await send('DOM.getDocument', { depth: 1 });
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#bmmFile' });
    check('la app expone el selector de captura', nodeId > 0);
    await send('DOM.setFileInputFiles', { nodeId, files: [SHOT] });
    await evaluate(`document.getElementById('bmmLaunch').click()`);

    // Esperar a que termine el reconocimiento (detector local + OCR de respaldo).
    let status = '';
    for (let i = 0; i < 240; i++) {
      status = await evaluate('document.getElementById("bmmOcrStatus").textContent');
      if (/Detecté|Error de reconocimiento|OCR adicional no disponible/.test(status)) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    check('el reconocimiento termina', /Detecté/.test(status), status);

    const read = await evaluate(`(() => ({
      crops: [0,1,2].map(i => document.getElementById('bmmOcr' + i).textContent),
      steps: [...document.querySelectorAll('#bmmSteps .bmm-step strong')].map(e => e.textContent),
      slots: [...document.querySelectorAll('#bmmSteps .bmm-step')].map(e => e.dataset.step),
    }))()`);

    const value = (t) => (String(t).match(/^(10|[A2-9JQK])/) || [])[1] || '';
    const got = read.crops.map(value);
    check('lee tu primera carta (A)', got[0] === 'A', JSON.stringify(read.crops));
    check('lee la carta del crupier (K)', got[1] === 'K', JSON.stringify(read.crops));
    check('lee tu segunda carta (10)', got[2] === '10', JSON.stringify(read.crops));

    const applied = await evaluate(`(() => {
      const before = [...document.querySelectorAll('#meHand .card-face:not(.fake):not(.virtual)')].length;
      return before;
    })()`);
    check('la mesa arranca sin cartas antes de confirmar', applied === 0, String(applied));

    close();
  } finally {
    edge.kill('SIGKILL');
    server.close();
  }

  console.log(failures.length ? `\nOCR FALLA (${failures.length})` : '\nOCR OK');
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
