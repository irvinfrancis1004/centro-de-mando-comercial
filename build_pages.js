#!/usr/bin/env node
/**
 * build_pages.js — Genera docs/index.html: el dashboard SIN datos, para publicar en GitHub Pages.
 *
 * Uso:
 *   node build_pages.js
 *
 * A diferencia de build.js (que inyecta pacientes.dat/adspend.dat reales), este siempre usa
 * RAW_RECORDS=[] y RAW_ADSPEND={} — el link público no debe traer nunca datos de pacientes.
 * Quien lo abra usa el botón "Subir Excel" para cargar su propio archivo; los datos se procesan
 * en su navegador y no salen de ahí. Correr esto después de cualquier cambio a
 * dashboard_template.html para que el link público quede al día con el código (no con los datos).
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const tplPath = path.join(ROOT, 'dashboard_template.html');
const outDir = path.join(ROOT, 'docs');
const outPath = path.join(outDir, 'index.html');

if (!fs.existsSync(tplPath)) {
  console.error('ERROR: falta dashboard_template.html en esta carpeta.');
  process.exit(1);
}

const tpl = fs.readFileSync(tplPath, 'utf8');
let out = tpl.replace('__DATA__', () => '[]').replace('__ADSPEND__', () => '{}');
if (out.includes('__DATA__') || out.includes('__ADSPEND__')) {
  console.error('ERROR: Quedó un placeholder sin reemplazar.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, out, 'utf8');
console.log(`OK  ·  ${out.length.toLocaleString('es-MX')} bytes  ->  docs/index.html (sin datos, para GitHub Pages)`);
