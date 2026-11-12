#!/usr/bin/env node
// Prueba del motor exacto (BJX) contra la simulación original (BJ).
// Uso: node qa/engine.mjs   — sin navegador ni dependencias.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const html = await readFile(path.resolve(import.meta.dirname, '..', 'v1.7m-staging', 'index.html'), 'utf8');
const start = html.indexOf('<script>/* Blackjack Live Analyzer');
const code = html.slice(start + '<script>'.length, html.indexOf('</script>', start));
const mod = { exports: {} };
new Function('module', code)(mod);
const BJ = mod.exports, BJX = mod.exports.BJX;

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(name);
}
const S = { decks: 6, seats: 3, iterations: 20000, h17: false, peekNoBJ: false, allowDouble: true, allowSplit: true, doubleAfterSplit: true, splitAcesOneCard: true, payout: 1.5 };
const data = (me, dealer, settings = S, others = []) => ({ me, dealer, spent: [], others, settings });
const best = (x) => ['stand', 'hit', 'double', 'split'].filter((a) => x[a]).sort((a, b) => x[b].ev - x[a].ev)[0];
function simulate(d, n) { const r = BJ.createRunner(d, n); while (r.step(5000)); return r.results(); }

// 1. Coincide con la simulación larga (plantarse, pedir, doblar).
for (const peekNoBJ of [false, true]) {
  for (const [me, dl] of [[['10', '6'], ['10']], [['A', '7'], ['9']], [['9', '2'], ['A']], [['10', '2'], ['3']], [['5', '5'], ['6']], [['10', '6', '2'], ['7']]]) {
    const d = data(me, dl, { ...S, peekNoBJ }), x = BJX.analyze(d), m = simulate(d, 400000);
    for (const a of ['stand', 'hit', 'double']) {
      if (!m[a]) continue;
      const evOk = Math.abs(m[a].ev - x[a].ev) < 0.012, winOk = Math.abs(m[a].win - x[a].win) < 0.004;
      check(`${me.join('+')} vs ${dl[0]} · ${a}${peekNoBJ ? ' · peek' : ''}`, evOk && winOk, `sim ${m[a].ev.toFixed(4)}/${m[a].win.toFixed(4)} exacto ${x[a].ev.toFixed(4)}/${x[a].win.toFixed(4)}`);
    }
  }
}

// 2. Las probabilidades suman 1.
{
  const x = BJX.analyze(data(['9', '7'], ['10']));
  for (const a of ['stand', 'hit', 'double']) check(`ganar + empatar + perder = 1 (${a})`, Math.abs(x[a].win + x[a].tie + x[a].lose - 1) < 1e-9);
}

// 3. Decisiones conocidas (6 mazos, crupier se planta en 17 blando, con peek).
const P = { ...S, peekNoBJ: true };
const known = [
  [['10', '6'], '7', 'hit'], [['10', '7'], '10', 'stand'], [['10', '3'], '6', 'stand'], [['6', '5'], '6', 'double'],
  [['A', 'A'], '6', 'split'], [['8', '8'], '10', 'split'], [['10', '10'], '6', 'stand'], [['5', '5'], '9', 'double'],
  [['A', '7'], '10', 'hit'], [['A', '7'], '2', 'stand'], [['A', '6'], '5', 'double'], [['9', '9'], '7', 'stand'],
  [['7', '7'], '8', 'hit'], [['10', '2'], '2', 'hit'], [['10', '2'], '5', 'stand'], [['A', 'K'], '6', 'stand'],
];
for (const [me, up, want] of known) { const got = best(BJX.analyze(data(me, [up], P))); check(`${me.join('+')} vs ${up} → ${want}`, got === want, got); }

// 4. Sin peek (el crupier no mira su carta): 11 contra 10 se pide, no se dobla.
check('sin peek: 6+5 vs 10 → hit', best(BJX.analyze(data(['6', '5'], ['10']))) === 'hit');

// 5. Blackjack natural: paga 3:2 y empata contra otro blackjack.
{
  const x = BJX.analyze(data(['A', 'K'], ['9']));
  check('blackjack contra 9 paga 1,5', Math.abs(x.stand.ev - 1.5) < 1e-9 && !x.hit, JSON.stringify(x.stand));
}

// 6. El ejemplo del tablero: 16 contra K con la mesa cargada.
{
  const x = BJX.analyze(data(['10', '6'], ['K'], S, [['A', '8'], ['5', '9'], ['10', '2']]));
  check('ejemplo: pedir es apenas mejor que plantarse', best(x) === 'hit' && Math.abs(x.hit.win - 0.1863) < 0.0005 && Math.abs(x.stand.win - 0.2125) < 0.0005, JSON.stringify(x));
}

// 7. Respuesta rápida incluso en la peor mano (8 mazos, 2+2 contra 2).
{
  const t0 = Date.now(); BJX.analyze(data(['2', '2'], ['2'], { ...S, decks: 8 })); const ms = Date.now() - t0;
  check('peor caso en menos de 1,5 s', ms < 1500, `${ms} ms`);
}

// 8. Reglas de «Blackjack Ilimitado»: peek sólo con As y seis cartas ganan.
{
  const U = { ...S, decks: 8, peekAceOnly: true, charlie6: true, doubleAfterSplit: false };
  const same = (a, b) => ['stand', 'hit', 'double'].every((k) => !a[k] === !b[k] && (!a[k] || Math.abs(a[k].ev - b[k].ev) < 1e-12));
  const noCharlie = { ...U, charlie6: false };
  check('peek sólo con As: contra As equivale a peek', same(BJX.analyze(data(['10', '6'], ['A'], noCharlie)), BJX.analyze(data(['10', '6'], ['A'], { ...noCharlie, peekAceOnly: false, peekNoBJ: true }))));
  check('peek sólo con As: contra 10 equivale a sin peek', same(BJX.analyze(data(['10', '6'], ['K'], noCharlie)), BJX.analyze(data(['10', '6'], ['K'], { ...noCharlie, peekAceOnly: false }))));
  // Cinco cartas que suman 12 contra 7: pedir gana si no te pasás (sexta carta), pierde si te pasás.
  const me = ['2', '2', '2', '3', '3'], x = BJX.analyze(data(me, ['7'], U));
  const left = 8 * 52 - 6, tens = 8 * 16, expected = (left - tens) / left - tens / left;
  check('seis cartas: pedir con cinco cartas vale P(no pasarse) − P(pasarse)', Math.abs(x.hit.ev - expected) < 1e-9, `${x.hit.ev} vs ${expected}`);
  check('seis cartas: con 12 y cinco cartas contra 7 conviene pedir', best(x) === 'hit');
  check('seis cartas: la guía marca «gana» para las que no se pasan', x.next.filter(Boolean).every((n) => n.act === (n.total > 21 ? 'bust' : 'win')));
  const six = BJX.analyze(data(['2', '2', '2', '3', '3', '4'], ['7'], U));
  check('seis cartas ya en mano: victoria segura y sin más acciones', six.stand.ev === 1 && !six.hit && !six.double);
  const off = BJX.analyze(data(me, ['7'], noCharlie));
  check('sin la regla, el mismo caso vale menos', off.hit.ev < x.hit.ev - 0.05);
  // 16 duro de cinco cartas contra 10: la regla vuelve mejor pedir
  const h16 = ['2', '3', '3', '4', '4'];
  check('seis cartas: 16 de cinco cartas contra 10 → pedir', best(BJX.analyze(data(h16, ['10'], U))) === 'hit');
}

console.log(failures.length ? `\nMOTOR FALLA (${failures.length})` : '\nMOTOR OK');
process.exit(failures.length ? 1 : 0);
