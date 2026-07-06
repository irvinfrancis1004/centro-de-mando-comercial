#!/usr/bin/env node
/**
 * excel_to_dat.js — Convierte el Excel de origen en el archivo intermedio pacientes.dat.
 *
 * Uso:
 *   node excel_to_dat.js                  -> usa ./COMERCIAL_JULIO.xlsx (o la ruta guardada en .last_source)
 *   node excel_to_dat.js "ruta\archivo.xlsx"  -> usa ese Excel como fuente y lo recuerda para la próxima vez
 *
 * Replica exactamente la lógica de parseWorkbook() del dashboard (dashboard_template.html)
 * para que el .dat generado aquí sea idéntico a lo que produciría el botón "Subir Excel".
 *
 * Soporta 2 formatos de Excel:
 *  - NUEVO (desde 2026-07): una sola hoja "BASE DE PACIENTES" con todos los canales. El canal de
 *    cada paciente se detecta buscando GOOGLE / PROMOCIONES / ORGANICO en el comentario
 *    (padecimiento); si no menciona ninguno, es FACEBOOK (Meta) — regla de Irvin, 2026-07-01.
 *  - VIEJO: una hoja "BASE DE PACIENTES ... <CANAL>" por canal (FACEBOOK/PROMOCIONES/GOOGLE/ORGANICO).
 * En ambos casos detecta el renglón de encabezados y mapea columnas por texto (ver AGENTS.md §5).
 *
 * Además aplica, en este orden, reglas de higiene de datos (ver AGENTS.md §5b):
 *   1. Regla fija: GOOGLE + sede MIXQUIAHUALA -> se reclasifica a FACEBOOK automáticamente.
 *   2. Regla fija: si un paciente está en ORGANICO y también en FACEBOOK (mismo número+nombre+
 *      sucursal), se elimina solo de FACEBOOK (ORGANICO manda) — sin preguntar, por pedido de Irvin.
 *   3. Detección de duplicados entre canales restantes: mismo número + nombre + sucursal
 *      (normalizados) apareciendo en más de un canal. Si ya hay una resolución en
 *      channel_overrides.json se aplica sola; si no, se reporta en consola para resolverla a mano
 *      (no se borra nada solo).
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = __dirname;
const LAST_SOURCE_FILE = path.join(ROOT, '.last_source');
const DEFAULT_XLSX = path.join(ROOT, 'COMERCIAL_JULIO.xlsx');
const OUT_DAT = path.join(ROOT, 'pacientes.dat');
const OUT_ADSPEND = path.join(ROOT, 'adspend.dat');
const OVERRIDES_FILE = path.join(ROOT, 'channel_overrides.json');

function resolveSourcePath() {
  const argPath = process.argv[2];
  if (argPath) return path.resolve(argPath);
  if (fs.existsSync(LAST_SOURCE_FILE)) {
    const saved = fs.readFileSync(LAST_SOURCE_FILE, 'utf8').trim();
    if (saved && fs.existsSync(saved)) return saved;
  }
  return DEFAULT_XLSX;
}

const SEDE_FIX = { CUATITLAN: 'CUAUTITLAN' };
const SEDE_RENAME = { NEZAHUALCOYOTL: 'NEZA', 'PLAZA NEZAHUALCOYOTL': 'PLAZA NEZA', MODERNA: 'LA MODERNA' };
/** El Excel trae nombres completos ("Clínica Equilibrio Total Balbuena", "Clínica FSH Mixquiahuala",
 *  "Equilibrio total Nicolás Romero"...) pero TIERS del dashboard usa códigos cortos
 *  ("BALBUENA", "MIXQUIAHUALA"...). Sin quitar el prefijo, ninguna sede calza con su división.
 *  Se quitan los prefijos conocidos en cualquier orden/combinación y luego se renombra. */
function normSede(s) {
  if (s == null || String(s).trim() === '') return 'SIN SEDE';
  let u = String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
  let prev;
  do {
    prev = u;
    u = u.replace(/^CLINICA\s+/, '').replace(/^EQUILIBRIO\s+TOTAL\s+/, '').replace(/^FSH\s+/, '').trim();
  } while (u !== prev);
  // a veces se pega un texto de directorio tipo "| Nicolás Romero | Fisioterapia & Rehabilitación"
  // en vez del nombre solo — se toma el primer segmento no vacío entre "|" como el nombre real.
  if (u.includes('|')) {
    const seg = u.split('|').map(x => x.trim()).filter(Boolean)[0];
    if (seg) u = seg;
  }
  u = SEDE_RENAME[u] || u;
  return SEDE_FIX[u] || u;
}
function asISO(v) {
  if (v == null) return null;
  if (!(v instanceof Date)) {
    // a veces la celda de fecha se guarda como texto "DD/MM/AAAA" en vez de fecha real de Excel
    const m = String(v).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) { const [, d, mo, y] = m; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; }
  }
  if (v instanceof Date && !isNaN(v)) {
    return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  }
  return String(v).slice(0, 10);
}
function isNum(v) { return typeof v === 'number' && isFinite(v); }

function normNumero(v) { return String(v || '').replace(/\D/g, ''); }
function normNombre(v) { return String(v || '').trim().toUpperCase().replace(/\s+/g, ' '); }
function patientKey(r) { return `${normNombre(r.nombre)}|${normNumero(r.numero)}|${r.sede}`; }

function loadOverrides() {
  if (!fs.existsSync(OVERRIDES_FILE)) {
    fs.writeFileSync(OVERRIDES_FILE, '[]\n', 'utf8');
    return new Map();
  }
  const list = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
  const map = new Map();
  for (const o of list) {
    map.set(`${normNombre(o.nombre)}|${normNumero(o.numero)}|${normSede(o.sede)}`, o.canal);
  }
  return map;
}

/** Aplica las reglas fijas (Mixquiahuala, prioridad de Orgánico sobre Facebook), resuelve
 *  duplicados ya conocidos vía channel_overrides.json y reporta en consola los duplicados entre
 *  canales que faltan por resolver. Nunca borra un registro sin regla fija o resolución explícita. */
function applyChannelRules(records) {
  let mixCount = 0;
  for (const r of records) {
    if (r.canal === 'GOOGLE' && r.sede === 'MIXQUIAHUALA') { r.canal = 'FACEBOOK'; mixCount++; }
  }

  const overrides = loadOverrides();
  const groups = new Map();
  for (const r of records) {
    const k = patientKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  const out = [];
  const pendingConflicts = [];
  let overrideResolvedCount = 0;
  let organicoPriorityCount = 0;
  let numeroVacioSkipped = 0;

  for (const [key, groupOriginal] of groups) {
    let group = groupOriginal;
    let canales = [...new Set(group.map(r => r.canal))];

    // Regla fija: Orgánico siempre gana sobre Facebook -> se descarta la copia de Facebook.
    if (canales.includes('ORGANICO') && canales.includes('FACEBOOK')) {
      const dropped = group.filter(r => r.canal === 'FACEBOOK').length;
      group = group.filter(r => r.canal !== 'FACEBOOK');
      organicoPriorityCount += dropped;
      canales = [...new Set(group.map(r => r.canal))];
    }

    if (canales.length <= 1) { out.push(...group); continue; }
    const [, numeroNorm] = key.split('|');
    if (!numeroNorm) { numeroVacioSkipped++; out.push(...group); continue; } // sin número no se puede confirmar el match

    if (overrides.has(key)) {
      const canalCorrecto = overrides.get(key);
      const match = group.find(r => r.canal === canalCorrecto) || group[0];
      match.canal = canalCorrecto;
      out.push(match);
      overrideResolvedCount += group.length - 1;
    } else {
      out.push(...group);
      pendingConflicts.push({ nombre: group[0].nombre, numero: group[0].numero, sede: group[0].sede, filas: group });
    }
  }

  return { records: out, mixCount, overrideResolvedCount, organicoPriorityCount, pendingConflicts, numeroVacioSkipped };
}

function reportConflicts(pendingConflicts) {
  if (!pendingConflicts.length) return;
  console.log('');
  console.log(`ATENCION · ${pendingConflicts.length} paciente(s) aparecen en más de un canal (mismo número + nombre + sucursal):`);
  pendingConflicts.forEach((c, i) => {
    const detalle = c.filas.map(r => `${r.canal} (fecha ${r.fecha || r.dia || 's/f'})`).join(', ');
    console.log(`  ${i + 1}. ${c.nombre} · ${c.numero} · ${c.sede}  ->  ${detalle}`);
  });
  console.log('  Dime a que canal pertenece cada uno (o si son personas distintas) y lo agrego a channel_overrides.json.');
  console.log('');
}

/** Si el comentario (padecimiento) menciona GOOGLE, PROMOCIONES u ORGANICO, esa es la fuente real
 *  de la cita, sin importar en qué hoja/sección esté. Si no menciona ninguno, es de FACEBOOK
 *  (Meta) — así lo pidió Irvin (2026-07-01): "si no dice nada las citas pertenecen a Facebook". */
function detectCanalFromPad(pad) {
  const s = String(pad || '').toUpperCase();
  if (/GOOGLE/.test(s)) return 'GOOGLE';
  if (/PROMOCION/.test(s)) return 'PROMOCIONES';
  if (/ORGANIC/.test(s)) return 'ORGANICO';
  return 'FACEBOOK';
}

/** Extrae pacientes de una hoja "BASE DE PACIENTES" ya localizada. canalFor(padecimiento) decide
 *  el canal de cada fila: fijo (formato viejo, una hoja por canal) o detectado por texto (formato
 *  nuevo, una sola hoja "BASE DE PACIENTES" para todos los canales). */
function extractPatientRows(rows, canalFor) {
  const out = [];
  if (!rows.length) return out;
  let hr = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    if (rows[i].some(c => c != null && /NOMBRE/i.test(String(c)))) { hr = i; break; }
  }
  if (hr < 0) hr = 0;
  const head = rows[hr].map(c => (c == null ? '' : String(c).trim().toUpperCase()));
  const col = (...keys) => {
    for (const k of keys) {
      const idx = head.findIndex(h => h.includes(k));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const ci = {
    dia: col('DIA'), nom: col('NOMBRE'), ape: col('APELLIDO'), num: col('NUMERO', 'NÚMERO'), fec: col('FECHA DE AGENDA', 'AGENDA'),
    sede: col('SEDE'), asis: col('ASISTE'), costo: col('COSTO'), plan: col('PLAN'), monto: col('MONTO'),
    cxc: col('CXC', 'CUENTA'), pad: col('PADECIMIENTO'), servicio: col('SERVICIO'),
  };
  for (let i = hr + 1; i < rows.length; i++) {
    const row = rows[i];
    const nm = ci.nom >= 0 ? row[ci.nom] : null;
    if (nm == null || String(nm).trim() === '') continue;
    const ape = ci.ape >= 0 && row[ci.ape] != null ? String(row[ci.ape]).trim() : '';
    const costo = ci.costo >= 0 ? row[ci.costo] : null;
    const padecimiento = ci.pad >= 0 && row[ci.pad] != null ? String(row[ci.pad]).replace(/\\n/g, '\n') : '';
    out.push({
      canal: canalFor(padecimiento),
      dia: asISO(ci.dia >= 0 ? row[ci.dia] : null),
      nombre: ape ? (String(nm).trim() + ' ' + ape) : String(nm).trim(),
      numero: ci.num >= 0 && row[ci.num] != null ? String(row[ci.num]).trim() : '',
      fecha: asISO(ci.fec >= 0 ? row[ci.fec] : null),
      sede: normSede(ci.sede >= 0 ? row[ci.sede] : null),
      asiste: ci.asis >= 0 && row[ci.asis] != null ? String(row[ci.asis]).trim().toUpperCase() : 'SIN DATO',
      costo_pago: isNum(costo) ? costo : 0,
      costo_pendiente: costo != null && !isNum(costo),
      plan: ci.plan >= 0 && row[ci.plan] != null ? String(row[ci.plan]).trim().toUpperCase() : 'SIN DATO',
      monto: ci.monto >= 0 && isNum(row[ci.monto]) ? row[ci.monto] : 0,
      cxc: ci.cxc >= 0 && isNum(row[ci.cxc]) ? row[ci.cxc] : 0,
      padecimiento,
      servicio: ci.servicio >= 0 && row[ci.servicio] != null ? String(row[ci.servicio]).trim() : '',
    });
  }
  return out;
}

function parseWorkbook(wb) {
  let out;
  // Formato nuevo (desde 2026-07): una sola hoja "BASE DE PACIENTES" para los 4 canales; el canal
  // de cada paciente se detecta por palabra clave en el comentario (ver detectCanalFromPad).
  const unifiedName = wb.SheetNames.find(n => /^\s*BASE DE PACIENTES\s*$/i.test(n));
  if (unifiedName) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[unifiedName], { header: 1, defval: null, raw: true, blankrows: false });
    out = extractPatientRows(rows, detectCanalFromPad);
  } else {
    // Formato viejo: una hoja "BASE DE PACIENTES ... <CANAL>" por canal.
    const map = [
      { canal: 'FACEBOOK', re: /BASE DE PACIENTES.*FACEBOO/i },
      { canal: 'PROMOCIONES', re: /BASE DE PACIENTES.*PROMO/i },
      { canal: 'GOOGLE', re: /BASE DE PACIENTES.*GOOGLE/i },
      { canal: 'ORGANICO', re: /BASE DE PACIENTES.*ORGANIC/i },
    ];
    out = [];
    for (const m of map) {
      const name = wb.SheetNames.find(n => m.re.test(n));
      if (!name) continue;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true, blankrows: false });
      out.push(...extractPatientRows(rows, () => m.canal));
    }
  }

  // GERONTOLOGIA (desde 2026-07-06): hoja aparte "BASE DE GERONTOLOGIA", siempre canal fijo.
  // Columnas propias: SERVICIO en vez de SEDE/PADECIMIENTO, sin DIA — extractPatientRows ya
  // rellena esos huecos con default (SIN SEDE / null / '') sin romper nada.
  const gerontoName = wb.SheetNames.find(n => /BASE DE.*GERONTOLOG/i.test(n));
  if (gerontoName) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[gerontoName], { header: 1, defval: null, raw: true, blankrows: false });
    out.push(...extractPatientRows(rows, () => 'GERONTOLOGIA'));
  }

  return out;
}

/** Hoja de presupuesto/rendimiento de FACEBOOK: viene en bloques repetidos (encabezado + filas de
 *  sucursal + fila TOTAL), uno por grupo de sucursales. Se detectan encabezados por columna (no por
 *  posición fija) y se saltan los renglones "SUCURSAL"/"TOTAL". */
function parseFacebookAdSheet(rows) {
  const bySede = {};
  let ci = null;
  for (const row of rows) {
    const first = row[0];
    if (first == null || String(first).trim() === '') continue;
    const label = String(first).trim().toUpperCase();
    if (label === 'SUCURSAL') {
      const head = row.map(c => (c == null ? '' : String(c).trim().toUpperCase()));
      // exacto primero (si no, "LEADS" empataría con "META LEADS" por substring)
      const col = (...keys) => {
        for (const k of keys) { const idx = head.findIndex(h => h === k); if (idx >= 0) return idx; }
        for (const k of keys) { const idx = head.findIndex(h => h.includes(k)); if (idx >= 0) return idx; }
        return -1;
      };
      ci = { metaPac: col('META DE PACIENTES'), metaLeads: col('META LEADS'), gastado: col('PP GASTADO', 'GASTADO'), leads: col('LEADS'), cpl: col('CPL') };
      continue;
    }
    if (label === 'TOTAL' || !ci) continue;
    const sede = normSede(first);
    const leads = ci.leads >= 0 && isNum(row[ci.leads]) ? row[ci.leads] : 0;
    const gastado = ci.gastado >= 0 && isNum(row[ci.gastado]) ? row[ci.gastado] : 0;
    const metaPacientes = ci.metaPac >= 0 && isNum(row[ci.metaPac]) ? row[ci.metaPac] : 0;
    const metaLeads = ci.metaLeads >= 0 && isNum(row[ci.metaLeads]) ? row[ci.metaLeads] : 0;
    const cpl = ci.cpl >= 0 && isNum(row[ci.cpl]) ? row[ci.cpl] : (leads ? gastado / leads : 0);
    bySede[sede] = { metaPacientes, metaLeads, gastado, leads, cpl };
  }
  return bySede;
}

/** Hojas de presupuesto de PROMOCIONES/GOOGLE/ORGANICO: hoy solo traen LEADS/PRESUPUESTO en
 *  agregado (sin desglose por sucursal). Suma lo que haya, hoy siempre 0 hasta que se capture. */
function parseAggregateAdSheet(rows) {
  const totals = { leads: 0, gastado: 0 };
  if (!rows || !rows.length) return totals;
  const head = rows[0].map(c => (c == null ? '' : String(c).trim().toUpperCase()));
  const col = (...keys) => {
    for (const k of keys) {
      const idx = head.findIndex(h => h.includes(k));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const ci = { leads: col('LEADS'), gastado: col('PRESUPUESTO', 'GASTADO') };
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (ci.leads >= 0 && isNum(row[ci.leads])) totals.leads += row[ci.leads];
    if (ci.gastado >= 0 && isNum(row[ci.gastado])) totals.gastado += row[ci.gastado];
  }
  return totals;
}

/** Hoja "PROYECCIONES" (agregada 2026-07-06): un PivotTable de Excel pegado tal cual, con un bloque
 *  por división (CORPORATIVO / FRANQUICIAS / FRANQUICIAS TERCERIZADAS) — citas agendadas por
 *  sucursal y día del mes ("las citas que tengo agendadas cada día", para ver qué día hay que
 *  apretar más). Estructura de cada bloque:
 *    fila 0: nombre de la división sola en col A
 *    fila 1: "Cuenta de Nombre" | "Etiquetas de columna"  (boilerplate del pivot, se ignora)
 *    fila 2: "Etiquetas de fila" | día | día | ... | "Total general"  (el día real, NO asumir 1..N
 *            consecutivo: si un día no tuvo citas en NINGUNA sucursal, Excel quita esa columna)
 *    filas siguientes: sucursal | cantidad por día | ...
 *    fila final del bloque: "Total general" | subtotal por día | ...
 *  Devuelve { CORPORATIVO: { BALBUENA: {1:2,2:3,...}, ... }, FRANQUICIAS: {...}, TERCERIZADAS: {...} } */
function parseProyecciones(rows) {
  const result = {};
  let i = 0;
  while (i < rows.length) {
    const row = rows[i] || [];
    const label = row[0] != null ? String(row[0]).trim().toUpperCase() : '';
    const isDivHeader = label && row.slice(1).every(c => c == null) &&
      rows[i + 1] && String((rows[i + 1][0]) || '').toUpperCase().includes('CUENTA DE');
    if (!isDivHeader) { i++; continue; }
    const divKey = label.includes('TERCERIZADA') ? 'TERCERIZADAS' : label.includes('FRANQUICIA') ? 'FRANQUICIAS' : label.includes('CORPORATIVO') ? 'CORPORATIVO' : label;
    const headRow = rows[i + 2] || [];
    const dayCols = [];
    for (let c = 1; c < headRow.length; c++) { if (isNum(headRow[c])) dayCols.push({ col: c, day: headRow[c] }); }
    result[divKey] = result[divKey] || {};
    let j = i + 3;
    while (j < rows.length && rows[j][0] != null && String(rows[j][0]).trim().toUpperCase() !== 'TOTAL GENERAL') {
      const sede = normSede(rows[j][0]);
      const byDay = result[divKey][sede] || {};
      for (const { col, day } of dayCols) { if (isNum(rows[j][col])) byDay[day] = (byDay[day] || 0) + rows[j][col]; }
      result[divKey][sede] = byDay;
      j++;
    }
    i = j + 1; // saltar también la fila "Total general" del bloque
  }
  return result;
}

function extractAdSpend(wb) {
  const sheetRows = (name) => {
    const sh = wb.Sheets[name];
    return sh ? XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true, blankrows: false }) : [];
  };
  const facebookBySede = parseFacebookAdSheet(sheetRows('FACEBOOK'));
  const facebookTotal = Object.values(facebookBySede).reduce(
    (a, s) => ({ metaPacientes: a.metaPacientes + s.metaPacientes, metaLeads: a.metaLeads + s.metaLeads, gastado: a.gastado + s.gastado, leads: a.leads + s.leads }),
    { metaPacientes: 0, metaLeads: 0, gastado: 0, leads: 0 }
  );
  facebookTotal.cpl = facebookTotal.leads ? facebookTotal.gastado / facebookTotal.leads : 0;
  return {
    FACEBOOK: { bySede: facebookBySede, total: facebookTotal },
    PROMOCIONES: { total: parseAggregateAdSheet(sheetRows('PROMOCIONES')) },
    GOOGLE: { total: parseAggregateAdSheet(sheetRows('GOOGLE')) },
    ORGANICO: { total: parseAggregateAdSheet(sheetRows('ORGANICO')) },
    GERONTOLOGIA: { total: parseAggregateAdSheet(sheetRows('GERONTOLOGIA')) },
    PLAN_DIARIO: parseProyecciones(sheetRows('PROYECCIONES')),
  };
}

const srcPath = resolveSourcePath();
if (!fs.existsSync(srcPath)) {
  console.error(`ERROR: no encontré el Excel de origen en: ${srcPath}`);
  process.exit(1);
}

const wb = XLSX.readFile(srcPath, { cellDates: true });
let records = parseWorkbook(wb);

if (records.length === 0) {
  console.warn('AVISO · no encontré pacientes (hoja "BASE DE PACIENTES" vacía o sin las hojas de canal esperadas). Sigo con lo que haya.');
}

const { records: cleaned, mixCount, overrideResolvedCount, organicoPriorityCount, pendingConflicts, numeroVacioSkipped } = applyChannelRules(records);
records = cleaned;

const adspend = extractAdSpend(wb);

fs.writeFileSync(OUT_DAT, JSON.stringify(records), 'utf8');
fs.writeFileSync(OUT_ADSPEND, JSON.stringify(adspend), 'utf8');
fs.writeFileSync(LAST_SOURCE_FILE, srcPath, 'utf8');

const porCanal = records.reduce((acc, r) => ((acc[r.canal] = (acc[r.canal] || 0) + 1), acc), {});
console.log(`OK  ·  fuente: ${srcPath}`);
console.log(`OK  ·  ${records.length} registros -> ${path.basename(OUT_DAT)}  (${JSON.stringify(porCanal)})`);
if (mixCount) console.log(`OK  ·  ${mixCount} registro(s) GOOGLE+MIXQUIAHUALA reclasificados a FACEBOOK (regla fija).`);
if (organicoPriorityCount) console.log(`OK  ·  ${organicoPriorityCount} registro(s) quitados de FACEBOOK por estar duplicados en ORGANICO (regla fija).`);
if (overrideResolvedCount) console.log(`OK  ·  ${overrideResolvedCount} duplicado(s) resueltos automáticamente vía channel_overrides.json.`);
if (numeroVacioSkipped) console.log(`AVISO · ${numeroVacioSkipped} caso(s) con mismo nombre+sede en varios canales pero sin número para confirmar -> se dejaron tal cual, revísalos si quieres.`);
reportConflicts(pendingConflicts);
console.log(`OK  ·  presupuesto -> ${path.basename(OUT_ADSPEND)}  (FACEBOOK: ${adspend.FACEBOOK.total.leads} leads / $${adspend.FACEBOOK.total.gastado} en ${Object.keys(adspend.FACEBOOK.bySede).length} sucursales)`);
