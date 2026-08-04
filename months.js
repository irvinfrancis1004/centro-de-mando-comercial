#!/usr/bin/env node
/**
 * months.js — Registro compartido de meses (months.json) para el pipeline multi-mes.
 *
 * Cada mes tiene: { key, label, year, source, frozen, frozenAt, updatedAt }
 *   key       'JULIO' | 'AGOSTO' | ... (siempre MAYÚSCULAS, es el identificador)
 *   label     'Julio' — para mostrar (Title Case)
 *   year      número, año en que se creó el mes (para el label completo "Julio 2026")
 *   source    ruta absoluta al Excel de origen de ese mes (se recuerda entre corridas)
 *   frozen    true = mes cerrado, excel_to_dat.js se niega a regenerarlo sin --force
 *   frozenAt  fecha ISO en que se congeló (solo si frozen), o null
 *   updatedAt fecha ISO de la última vez que se corrió excel_to_dat.js para este mes
 *
 * months.json vive en la raíz del proyecto, NO se sube a GitHub (contiene rutas locales) — ver
 * .gitignore. Si no existe, se crea vacío al primer uso.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MONTHS_FILE = path.join(ROOT, 'months.json');
const DATA_ROOT = path.join(ROOT, 'data');

function load() {
  if (!fs.existsSync(MONTHS_FILE)) return { months: [] };
  return JSON.parse(fs.readFileSync(MONTHS_FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(MONTHS_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function find(data, key) {
  const k = String(key || '').toUpperCase().trim();
  return data.months.find(m => m.key === k) || null;
}

function upsert(data, entry) {
  const idx = data.months.findIndex(m => m.key === entry.key);
  if (idx >= 0) data.months[idx] = { ...data.months[idx], ...entry };
  else data.months.push(entry);
  return data;
}

/** El "mes activo" es el único mes no congelado. Si hay 0 o 2+, no hay uno solo obvio -> null
 *  (quien llame debe pedir que se especifique el mes explícitamente). */
function activeMonth(data) {
  const open = data.months.filter(m => !m.frozen);
  return open.length === 1 ? open[0] : null;
}

function labelFor(key, year) {
  const k = String(key).toUpperCase();
  const nice = k.charAt(0) + k.slice(1).toLowerCase();
  return year ? `${nice} ${year}` : nice;
}

function dataDir(key) {
  return path.join(DATA_ROOT, String(key).toUpperCase());
}

function htmlFileName(key) {
  return `Centro_de_Mando_Comercial_${String(key).toUpperCase()}.html`;
}

function htmlPath(key) {
  return path.join(ROOT, htmlFileName(key));
}

module.exports = {
  ROOT, MONTHS_FILE, DATA_ROOT,
  load, save, find, upsert, activeMonth, labelFor, dataDir, htmlFileName, htmlPath,
};
