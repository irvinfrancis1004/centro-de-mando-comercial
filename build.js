#!/usr/bin/env node
/**
 * build.js — Equivalente a build.py, para máquinas sin Python (usa solo Node, ya requerido por excel_to_dat.js).
 *
 * Uso:
 *   node build.js
 *
 * Toma dashboard_template.html (placeholders `const RAW_RECORDS = __DATA__;` y
 * `const RAW_ADSPEND = __ADSPEND__;`) y les inyecta pacientes.dat/json y adspend.dat,
 * generando Centro_de_Mando_Comercial.html.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const tplPath = path.join(ROOT, 'dashboard_template.html');
const candidates = [
  path.join(ROOT, 'pacientes.dat'),
  path.join(ROOT, 'pacientes.json'),
  path.join(ROOT, 'data', 'pacientes.dat'),
  path.join(ROOT, 'data', 'pacientes.json'),
];
const dataPath = candidates.find(p => fs.existsSync(p));
const adspendPath = path.join(ROOT, 'adspend.dat');

if (!fs.existsSync(tplPath)) {
  console.error('ERROR: falta dashboard_template.html en esta carpeta.');
  process.exit(1);
}
if (!dataPath) {
  console.error('ERROR: falta pacientes.dat / pacientes.json (busqué en ./ y ./data/). Corre antes: node excel_to_dat.js');
  process.exit(1);
}

const tpl = fs.readFileSync(tplPath, 'utf8');
const data = fs.readFileSync(dataPath, 'utf8').trim();
const adspend = fs.existsSync(adspendPath) ? fs.readFileSync(adspendPath, 'utf8').trim() : '{}';

const n = (tpl.match(/__DATA__/g) || []).length;
if (n !== 1) {
  console.error(`ERROR: se esperaba exactamente 1 placeholder __DATA__ en la plantilla, encontré ${n}.`);
  process.exit(1);
}
const na = (tpl.match(/__ADSPEND__/g) || []).length;
if (na !== 1) {
  console.error(`ERROR: se esperaba exactamente 1 placeholder __ADSPEND__ en la plantilla, encontré ${na}.`);
  process.exit(1);
}

let out = tpl.replace('__DATA__', () => data);
out = out.replace('__ADSPEND__', () => adspend);
if (out.includes('__DATA__') || out.includes('__ADSPEND__')) {
  console.error('ERROR: Quedó un placeholder sin reemplazar.');
  process.exit(1);
}

const outPath = path.join(ROOT, 'Centro_de_Mando_Comercial.html');
fs.writeFileSync(outPath, out, 'utf8');
console.log(`OK  ·  ${out.length.toLocaleString('es-MX')} bytes  ->  ${path.basename(outPath)}  (fuente: ${path.basename(dataPath)} + ${fs.existsSync(adspendPath) ? path.basename(adspendPath) : 'sin adspend'})`);
console.log('Ábrelo directo en el navegador (doble clic). No necesita servidor.');
