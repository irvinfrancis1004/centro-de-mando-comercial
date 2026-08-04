#!/usr/bin/env node
/**
 * build.js — data/<MES>/pacientes.dat + adspend.dat -> Centro_de_Mando_Comercial_<MES>.html.
 *
 * Uso:
 *   node build.js            -> construye TODOS los meses que tengan datos en data/, + el selector
 *   node build.js AGOSTO     -> construye solo ese mes (y de todos modos refresca el selector)
 *
 * Toma dashboard_template.html (placeholders `const RAW_RECORDS = __DATA__;`,
 * `const RAW_ADSPEND = __ADSPEND__;`, `__MES_LABEL__`, `__MES_STATUS__`, `__MES_BADGE_CLASS__`,
 * `__FUENTE_LABEL__`) y genera un HTML por mes. El selector (Centro_de_Mando_Comercial.html, el
 * archivo que se abre con doble clic) se genera aparte con build_selector.js — ver AGENTS.md §15.
 */
const fs = require('fs');
const path = require('path');
const MONTHS = require('./months');
const { build: buildSelector } = require('./build_selector');

const ROOT = __dirname;
const tplPath = path.join(ROOT, 'dashboard_template.html');

if (!fs.existsSync(tplPath)) {
  console.error('ERROR: falta dashboard_template.html en esta carpeta.');
  process.exit(1);
}
const tpl = fs.readFileSync(tplPath, 'utf8');

function buildOne(month) {
  const dataDir = MONTHS.dataDir(month.key);
  const dataPath = path.join(dataDir, 'pacientes.dat');
  const adspendPath = path.join(dataDir, 'adspend.dat');
  if (!fs.existsSync(dataPath)) {
    console.error(`ERROR: falta ${path.relative(ROOT, dataPath)}. Corre antes: node excel_to_dat.js ${month.key}`);
    return false;
  }

  const data = fs.readFileSync(dataPath, 'utf8').trim();
  const adspend = fs.existsSync(adspendPath) ? fs.readFileSync(adspendPath, 'utf8').trim() : '{}';
  const label = MONTHS.labelFor(month.key, month.year);
  const status = month.frozen ? 'cerrado' : 'vigente';
  const badgeClass = month.frozen ? 'cerrado' : 'vigente';
  const fuente = month.source ? path.basename(month.source) : 'sin excel';

  let out = tpl
    .replace('__DATA__', () => data)
    .replace('__ADSPEND__', () => adspend)
    .replace(/__MES_LABEL__/g, () => label)
    .replace(/__MES_STATUS__/g, () => status)
    .replace(/__MES_BADGE_CLASS__/g, () => badgeClass)
    .replace(/__MES_BADGE_HREF__/g, () => 'Centro_de_Mando_Comercial.html')
    .replace(/__FUENTE_LABEL__/g, () => fuente);

  if (/__DATA__|__ADSPEND__|__MES_LABEL__|__MES_STATUS__|__MES_BADGE_CLASS__|__MES_BADGE_HREF__|__FUENTE_LABEL__/.test(out)) {
    console.error(`ERROR (${month.key}): quedó un placeholder sin reemplazar.`);
    return false;
  }

  const outPath = MONTHS.htmlPath(month.key);
  fs.writeFileSync(outPath, out, 'utf8');
  console.log(`OK  ·  ${out.length.toLocaleString('es-MX')} bytes  ->  ${path.basename(outPath)}  (${label} · ${status})`);
  return true;
}

const monthsData = MONTHS.load();
const argKey = process.argv[2] ? process.argv[2].toUpperCase().trim() : null;

let targets;
if (argKey) {
  const m = MONTHS.find(monthsData, argKey);
  if (!m) {
    console.error(`ERROR: no conozco el mes ${argKey} (months.json). Corre primero: node excel_to_dat.js ${argKey} "ruta.xlsx"`);
    process.exit(1);
  }
  targets = [m];
} else {
  targets = monthsData.months;
  if (!targets.length) {
    console.error('ERROR: no hay meses en months.json todavía. Corre primero: node excel_to_dat.js <MES> "ruta.xlsx"');
    process.exit(1);
  }
}

let okCount = 0;
for (const m of targets) {
  if (buildOne(m)) okCount++;
}

buildSelector(monthsData);

if (!okCount) process.exit(1);
console.log('Ábrelo directo en el navegador (doble clic sobre Centro_de_Mando_Comercial.html). No necesita servidor.');
