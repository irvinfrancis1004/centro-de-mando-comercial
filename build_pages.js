#!/usr/bin/env node
/**
 * build_pages.js — Genera docs/index.html: el dashboard CON los datos reales de pacientes,
 * para publicar en GitHub Pages (link público).
 *
 * Uso:
 *   node build_pages.js
 *
 * Decisión explícita de Irvin (2026-07-04): el link público sí lleva datos reales de pacientes
 * (nombre, teléfono, padecimiento) horneados, entendiendo que cualquiera con el link los vería —
 * es la única forma gratis de lograr "actualizo el Excel, corro un comando, se refleja para todo
 * el que tenga el link, sin que reboten con Subir Excel". Ver AGENTS.md §14 para el historial
 * completo de por qué se descartaron antes las alternativas (GitHub Pro no sirve para esto,
 * Cloudflare Access sí serviría pero no se llegó a montar).
 *
 * Es exactamente lo mismo que build.js, solo que escribe en docs/index.html en vez de
 * Centro_de_Mando_Comercial.html (para que GitHub Pages lo sirva).
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const tplPath = path.join(ROOT, 'dashboard_template.html');
const candidates = [
  path.join(ROOT, 'pacientes.dat'),
  path.join(ROOT, 'pacientes.json'),
];
const dataPath = candidates.find(p => fs.existsSync(p));
const adspendPath = path.join(ROOT, 'adspend.dat');
const outDir = path.join(ROOT, 'docs');
const outPath = path.join(outDir, 'index.html');

if (!fs.existsSync(tplPath)) {
  console.error('ERROR: falta dashboard_template.html en esta carpeta.');
  process.exit(1);
}
if (!dataPath) {
  console.error('ERROR: falta pacientes.dat / pacientes.json. Corre antes: node excel_to_dat.js');
  process.exit(1);
}

const tpl = fs.readFileSync(tplPath, 'utf8');
const data = fs.readFileSync(dataPath, 'utf8').trim();
const adspend = fs.existsSync(adspendPath) ? fs.readFileSync(adspendPath, 'utf8').trim() : '{}';

let out = tpl.replace('__DATA__', () => data).replace('__ADSPEND__', () => adspend);
if (out.includes('__DATA__') || out.includes('__ADSPEND__')) {
  console.error('ERROR: Quedó un placeholder sin reemplazar.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, out, 'utf8');
console.log(`OK  ·  ${out.length.toLocaleString('es-MX')} bytes  ->  docs/index.html (CON datos reales, para GitHub Pages)`);
