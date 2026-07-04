#!/usr/bin/env node
/**
 * publish.js — El único comando que Irvin necesita correr después de actualizar el Excel:
 *
 *   1. node excel_to_dat.js   -> pacientes.dat / adspend.dat
 *   2. node build.js          -> Centro_de_Mando_Comercial.html (para abrir localmente)
 *   3. node build_pages.js    -> docs/index.html (CON datos reales, ver build_pages.js)
 *   4. git add docs/index.html && git commit && git push -> el link público queda actualizado
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
  execSync('git add docs/index.html', { cwd: ROOT, stdio: 'inherit' });
  execSync('git diff --cached --quiet -- docs/index.html', { cwd: ROOT });
  console.log('\nOK  ·  docs/index.html no cambió — nada que publicar.');
} catch {
  // git diff --cached --quiet sale con código 1 cuando SÍ hay cambios staged -> toca commit+push
  run('git commit -m "Actualizar dashboard publicado"');
  run('git push');
  console.log('\nOK  ·  Publicado. El link público ya refleja los datos de hoy.');
}
