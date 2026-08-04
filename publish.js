#!/usr/bin/env node
/**
 * publish.js — El único comando que Irvin necesita correr después de actualizar el Excel del mes
 * activo (multi-mes, ver AGENTS.md §15 — los 3 comandos de abajo resuelven el mes activo solos,
 * el único no congelado en months.json; no hace falta pasarlo):
 *
 *   1. node excel_to_dat.js   -> data/<MES>/pacientes.dat / adspend.dat
 *   2. node build.js          -> Centro_de_Mando_Comercial_<MES>.html (todos los meses) + selector
 *   3. node build_pages.js    -> docs/<mes>.html del mes activo + docs/index.html (selector con
 *                                TODOS los meses que ya tengan página en docs/, ver AGENTS.md §14)
 *   4. git add docs/ && git commit && git push -> el link público queda actualizado
 *
 * Uso:
 *   node publish.js
 *
 * Requiere que el repo ya tenga un remoto configurado (origin) y sesión de `gh`/git activa.
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = __dirname;
const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
};

run('node excel_to_dat.js');
run('node build.js');
run('node build_pages.js');

try {
  execSync('git add docs/', { cwd: ROOT, stdio: 'inherit' });
  execSync('git diff --cached --quiet -- docs/', { cwd: ROOT });
  console.log('\nOK  ·  docs/ no cambió — nada que publicar.');
} catch {
  // git diff --cached --quiet sale con código 1 cuando SÍ hay cambios staged -> toca commit+push
  run('git commit -m "Actualizar dashboard publicado"');
  run('git push');
  console.log('\nOK  ·  Publicado. El link público ya refleja los datos de hoy.');
}
