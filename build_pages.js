#!/usr/bin/env node
/**
 * build_pages.js — Genera docs/ para GitHub Pages (link público): un dashboard con datos reales
 * de paciente por cada mes (docs/<mes>.html) + un selector (docs/index.html) que enlaza a todos.
 *
 * Uso:
 *   node build_pages.js          -> reconstruye TODOS los meses que ya tengan data/<MES>/pacientes.dat
 *   node build_pages.js AGOSTO   -> reconstruye solo ese mes (igual refresca el selector con todos)
 *
 * Cambio 2026-08-04 (petición explícita de Irvin, confirmando que entiende la exposición de datos):
 * el link público ahora deja **elegir el mes**, igual que el dashboard local — antes horneaba solo
 * el mes vigente a propósito para limitar qué quedaba público (ver el historial de este archivo /
 * AGENTS.md §14). Irvin ya había aceptado publicar datos reales de paciente para el mes vigente (ver
 * la nota de 2026-07-04 abajo); el 2026-08-04 pidió extenderlo a todos los meses, incluidos los
 * cerrados (Julio) — cada mes que se construya aquí queda público con nombre/teléfono/padecimiento
 * reales mientras el repo exista, sin importar si está congelado.
 *
 * Decisión explícita de Irvin (2026-07-04): el link público sí lleva datos reales de pacientes
 * (nombre, teléfono, padecimiento) horneados, entendiendo que cualquiera con el link los vería —
 * es la única forma gratis de lograr "actualizo el Excel, corro un comando, se refleja para todo
 * el que tenga el link, sin que reboten con Subir Excel". Ver AGENTS.md §14 para el historial
 * completo de por qué se descartaron antes las alternativas.
 *
 * Cada docs/<mes>.html es lo mismo que Centro_de_Mando_Comercial_<MES>.html (build.js), solo que
 * vive en docs/ (para que GitHub Pages lo sirva) con nombre en minúsculas y sin acentos.
 */
const fs = require('fs');
const path = require('path');
const MONTHS = require('./months');

const ROOT = __dirname;
const tplPath = path.join(ROOT, 'dashboard_template.html');
const outDir = path.join(ROOT, 'docs');

if (!fs.existsSync(tplPath)) {
  console.error('ERROR: falta dashboard_template.html en esta carpeta.');
  process.exit(1);
}

function pageFileName(key) {
  return String(key).toLowerCase() + '.html';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtFecha(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildMonthPage(tpl, month) {
  const dataDir = MONTHS.dataDir(month.key);
  const dataPath = path.join(dataDir, 'pacientes.dat');
  const adspendPath = path.join(dataDir, 'adspend.dat');
  if (!fs.existsSync(dataPath)) return null;

  const data = fs.readFileSync(dataPath, 'utf8').trim();
  const adspend = fs.existsSync(adspendPath) ? fs.readFileSync(adspendPath, 'utf8').trim() : '{}';
  const label = MONTHS.labelFor(month.key, month.year);
  const fuente = month.source ? path.basename(month.source) : 'sin excel';

  let out = tpl
    .replace('__DATA__', () => data)
    .replace('__ADSPEND__', () => adspend)
    .replace(/__MES_LABEL__/g, () => label)
    .replace(/__MES_STATUS__/g, () => (month.frozen ? 'cerrado' : 'vigente'))
    .replace(/__MES_BADGE_CLASS__/g, () => (month.frozen ? 'cerrado' : 'vigente'))
    .replace(/__MES_BADGE_HREF__/g, () => 'index.html')
    .replace(/__FUENTE_LABEL__/g, () => fuente);

  if (/__DATA__|__ADSPEND__|__MES_LABEL__|__MES_STATUS__|__MES_BADGE_CLASS__|__MES_BADGE_HREF__|__FUENTE_LABEL__/.test(out)) {
    console.error(`ERROR: quedó un placeholder sin reemplazar en ${month.key}.`);
    process.exit(1);
  }
  return out;
}

function selectorCardHtml(month) {
  const label = MONTHS.labelFor(month.key, month.year);
  const vigente = !month.frozen;
  const statusTxt = vigente ? 'vigente' : 'cerrado';
  const sub = vigente
    ? `Se sigue alimentando con el Excel del mes${fmtFecha(month.updatedAt) ? ' · última actualización ' + fmtFecha(month.updatedAt) : ''}.`
    : `Cerrado${fmtFecha(month.frozenAt) ? ' el ' + fmtFecha(month.frozenAt) : ''} · los datos ya no cambian.`;
  const fuente = month.source ? path.basename(month.source) : null;
  const href = pageFileName(month.key);
  return `
    <a class="card ${vigente ? 'vigente' : 'cerrado'}" href="${esc(href)}">
      <div class="card-top">
        <span class="pill ${vigente ? 'vigente' : 'cerrado'}"><span class="dot"></span>${statusTxt}</span>
        ${fuente ? `<span class="src">${esc(fuente)}</span>` : ''}
      </div>
      <h3>${esc(label)}</h3>
      <p>${esc(sub)}</p>
      <div class="cta">Abrir dashboard <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </a>`;
}

function buildSelector(months) {
  const body = months.length
    ? `<div class="grid">${months.map(selectorCardHtml).join('\n')}</div>`
    : `<div class="empty">Todavía no hay ningún dashboard publicado.</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Centro de Mando Comercial · Equilibrio Total</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0B1519; --bg2:#0F1E23; --panel:#13242A; --card:#16282F; --card2:#1A2F37;
  --line:#22383F; --line2:#2C4750;
  --ink:#E9F2F0; --ink2:#A6BEC3; --dim:#6E878D;
  --teal:#19C2A8; --teal-d:#0E8E7C; --lime:#86DD57;
  --r:16px;
  --sh:0 1px 0 rgba(255,255,255,.03) inset, 0 18px 40px -28px rgba(0,0,0,.9);
  --mono:'Space Mono',monospace; --disp:'Space Grotesk',sans-serif; --body:'Plus Jakarta Sans',sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:
    radial-gradient(1200px 600px at 78% -8%, rgba(25,194,168,.10), transparent 60%),
    radial-gradient(900px 500px at 0% 0%, rgba(91,141,239,.07), transparent 55%),
    var(--bg);
  color:var(--ink); font-family:var(--body);
  -webkit-font-smoothing:antialiased; min-height:100vh;
}
.wrap{max-width:920px;margin:0 auto;padding:60px 22px 80px}
.brand{display:flex;align-items:center;gap:13px;margin-bottom:44px}
.glyph{
  width:46px;height:46px;border-radius:12px;flex:none;position:relative;
  background:linear-gradient(150deg,#11332E,#0c1f23);
  border:1px solid var(--line2);display:grid;place-items:center;
  box-shadow:0 0 0 1px rgba(25,194,168,.12) inset, 0 8px 22px -10px rgba(25,194,168,.4);
}
.glyph svg{width:26px;height:26px}
.brand-tx b{font-family:var(--disp);font-weight:700;font-size:17px;letter-spacing:.2px;display:block;line-height:1.2}
.brand-tx span{font-family:var(--mono);font-size:11px;letter-spacing:1.5px;color:var(--teal);text-transform:uppercase}
h1{font-family:var(--disp);font-weight:600;font-size:26px;margin:0 0 8px;letter-spacing:.2px}
.lead{color:var(--ink2);margin:0 0 34px;font-size:14px;max-width:56ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.card{
  display:block;text-decoration:none;color:var(--ink);
  background:linear-gradient(180deg,var(--card2),var(--card));
  border:1px solid var(--line);border-radius:var(--r);padding:20px 22px;box-shadow:var(--sh);
  transition:transform .15s,border-color .15s,box-shadow .15s;
}
.card:hover{transform:translateY(-2px);border-color:var(--line2);box-shadow:0 1px 0 rgba(255,255,255,.03) inset,0 24px 48px -26px rgba(0,0,0,.95)}
.card.vigente{border-color:rgba(25,194,168,.35)}
.card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.pill{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;
  color:var(--ink2);background:var(--bg2);border:1px solid var(--line);border-radius:20px;padding:5px 11px}
.pill .dot{width:6px;height:6px;border-radius:50%;flex:none}
.pill.vigente .dot{background:var(--lime);box-shadow:0 0 0 3px rgba(134,221,87,.18)}
.pill.vigente{color:#CFEFC0}
.pill.cerrado .dot{background:var(--dim)}
.src{font-family:var(--mono);font-size:10px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px}
.card h3{font-family:var(--disp);font-weight:700;font-size:20px;margin:0 0 6px;letter-spacing:.2px}
.card p{margin:0 0 18px;font-size:12.5px;color:var(--ink2);line-height:1.5}
.cta{display:inline-flex;align-items:center;gap:7px;font-family:var(--body);font-weight:600;font-size:12.5px;color:var(--teal)}
.cta svg{width:15px;height:15px;transition:transform .15s}
.card:hover .cta svg{transform:translateX(3px)}
.empty{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:28px;color:var(--ink2);font-size:13.5px;line-height:1.7}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">
    <div class="glyph" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none"><path d="M3 14.5c1.6 0 1.6-5 3.2-5s1.6 9 3.2 9 1.6-12 3.2-12 1.6 7 3.2 7 1.6-3 3-3" stroke="#19C2A8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20.6" cy="9.5" r="1.5" fill="#86DD57"/></svg>
    </div>
    <div class="brand-tx">
      <b>Equilibrio Total</b>
      <span>Centro de Mando Comercial</span>
    </div>
  </div>
  <h1>¿Qué mes quieres ver?</h1>
  <p class="lead">Cada mes vive en su propio dashboard, con datos reales de paciente. Los meses cerrados quedan congelados tal cual estaban — no se vuelven a mover.</p>
  ${body}
</div>
</body>
</html>
`;
}

const monthsData = MONTHS.load();
const argKey = process.argv[2] ? process.argv[2].toUpperCase().trim() : null;
const targets = argKey ? [MONTHS.find(monthsData, argKey)].filter(Boolean) : monthsData.months;
if (argKey && !targets.length) {
  console.error(`ERROR: no conozco el mes "${argKey}". Meses conocidos: ${monthsData.months.map(m => m.key).join(', ') || '(ninguno todavía)'}`);
  process.exit(1);
}

const tpl = fs.readFileSync(tplPath, 'utf8');
fs.mkdirSync(outDir, { recursive: true });

let built = 0;
for (const month of targets) {
  const html = buildMonthPage(tpl, month);
  if (!html) {
    console.log(`SKIP  ·  ${month.key} — falta data/${month.key}/pacientes.dat (corre node excel_to_dat.js ${month.key})`);
    continue;
  }
  const outPath = path.join(outDir, pageFileName(month.key));
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`OK  ·  ${html.length.toLocaleString('es-MX')} bytes  ->  docs/${pageFileName(month.key)}  (${MONTHS.labelFor(month.key, month.year)}, CON datos reales)`);
  built++;
}

// el selector siempre se reconstruye completo, con TODOS los meses que ya tengan página en docs/
const publishedMonths = monthsData.months
  .filter(m => fs.existsSync(path.join(outDir, pageFileName(m.key))))
  .sort((a, b) => {
    if (!!a.frozen !== !!b.frozen) return a.frozen ? 1 : -1; // vigente primero
    const ad = a.frozen ? a.frozenAt : a.updatedAt, bd = b.frozen ? b.frozenAt : b.updatedAt;
    return String(bd || '').localeCompare(String(ad || ''));
  });
const selectorHtml = buildSelector(publishedMonths);
fs.writeFileSync(path.join(outDir, 'index.html'), selectorHtml, 'utf8');
console.log(`OK  ·  ${selectorHtml.length.toLocaleString('es-MX')} bytes  ->  docs/index.html  (selector, ${publishedMonths.length} mes(es))`);

if (!built && !fs.existsSync(path.join(outDir, 'index.html'))) {
  console.error('ERROR: no se construyó ningún mes.');
  process.exit(1);
}
