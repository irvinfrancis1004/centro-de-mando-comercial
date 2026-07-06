# AGENTS.md — Centro de Mando Comercial · Equilibrio Total

Contexto para agentes de IA (Antigravity / Cursor / Windsurf) y para el equipo.
Léelo completo antes de tocar código.

---

## 1. Qué es esto

Un **dashboard comercial de una sola página HTML, auto-contenido**, para la red de clínicas
de rehabilitación **Equilibrio Total** (22 sedes en 3 divisiones). Diagnostica el embudo
comercial **Leads → Agendados → Efectivos → Planes** por canal, división y sucursal, e incluye
ranking por sucursal, semáforo de salud, focos rojos y presupuesto/CAC por canal.

- **Funciona sin conexión** (offline-first). La única parte que necesita internet es el botón
  **Subir Excel** (carga SheetJS desde CDN).
- **Sin framework**: HTML + CSS + JavaScript vanilla, todo en un archivo.
- **No usa localStorage** ni backend. Todo el estado vive en memoria durante la sesión.

## 2. Estructura del proyecto

```
centro-de-mando/
├── AGENTS.md                       ← este archivo
├── README.md                       ← guía corta para humanos
├── excel_to_dat.js                 ← Excel -> pacientes.dat (Node, replica parseWorkbook + higiene de canales)
├── channel_overrides.json          ← resoluciones manuales de duplicados entre canales (ver §5b)
├── build.py                        ← pacientes.dat/json -> HTML final (requiere Python)
├── build.js                        ← lo mismo que build.py, en Node (usar si no hay Python)
├── package.json                    ← dependencia `xlsx` (SheetJS) + scripts npm
├── .last_source                    ← recuerda qué Excel se usó la última vez (autogenerado, no se sube)
├── dashboard_template.html         ← FUENTE que se edita (tiene los placeholders __DATA__ y __ADSPEND__)
├── pacientes.dat                   ← datos vigentes, generados desde el Excel (autogenerado, NO se sube a GitHub)
├── adspend.dat                     ← presupuesto/leads reales por canal (autogenerado, NO se sube a GitHub, ver §5c)
├── pacientes.json                  ← snapshot histórico (612 registros = 204 × 3 canales espejo); NO se sube a GitHub
├── Centro_de_Mando_Comercial.html  ← SALIDA generada con datos reales (es lo que se abre localmente, NO se sube a GitHub)
└── COMERCIAL_JULIO.xlsx            ← Excel original de origen (base de pacientes, NO se sube a GitHub)
```

**Regla de oro:** se edita `dashboard_template.html`. Los archivos `pacientes.dat` y
`Centro_de_Mando_Comercial.html` son generados — no los edites a mano, se sobrescriben al construir.

## 3. Cómo actualizar los datos y construir

Pipeline de 2 pasos, pensado para que cada mes solo haga falta reemplazar el Excel:

```bash
node excel_to_dat.js                        # usa ./COMERCIAL_JULIO.xlsx (o el último Excel usado)
node excel_to_dat.js "ruta\al\excel.xlsx"   # o apunta a un Excel específico (lo recuerda para la próxima)
node build.js                                # pacientes.dat -> Centro_de_Mando_Comercial.html (no requiere Python)
```

O en un solo paso: `npm run update` (corre ambos). También existen `npm run dat` y `npm run build`.

Si tu máquina sí tiene Python, `python3 build.py` funciona igual que `build.js` (mismo resultado,
ambos leen `pacientes.dat` primero y caen a `pacientes.json` si no existe). `excel_to_dat.js`
requiere Node + el paquete `xlsx` (ya declarado en `package.json`; `npm install` si falta `node_modules`).

Luego abre `Centro_de_Mando_Comercial.html` con doble clic (no necesita servidor).

El flujo completo es: `excel_to_dat.js` parsea el Excel exactamente igual que `parseWorkbook()`
(la función que corre en el navegador al usar "Subir Excel" — mismo código, portado a Node) y
escribe `pacientes.dat` (JSON). `dashboard_template.html` contiene la línea
`const RAW_RECORDS = __DATA__;`; `build.py`/`build.js` reemplazan `__DATA__` por ese JSON. Así el
dashboard queda auto-contenido otra vez.

> Para editar el estilo/lógica: trabaja en la plantilla, corre `node build.js` (o `python3 build.py`),
> refresca el navegador. Para probar rápido sin build: también puedes abrir el
> `Centro_de_Mando_Comercial.html` ya generado y editar ahí directo (es el mismo código, solo que
> con los datos pegados).
>
> **Para actualizar los datos del mes sin usar "Subir Excel" en el navegador:** reemplaza/edita
> `COMERCIAL_JULIO.xlsx` (o pasa la ruta de tu Excel a `excel_to_dat.js`) y corre `npm run update`.

## 4. Modelo de datos

Cada registro (fila del Excel, ya limpio) es un objeto:

```
canal            'FACEBOOK' | 'PROMOCIONES' | 'GOOGLE' | 'ORGANICO' | 'GERONTOLOGIA'
dia              fecha ISO (día del registro)
nombre           string
numero           string (teléfono)
fecha            fecha ISO de la CITA (fecha de agenda). Su presencia define "agendado".
sede             string en MAYÚSCULAS (normalizada); 'SIN SEDE' si el canal no la trae (GERONTOLOGIA)
asiste           'SI' | 'NO' | 'PENDIENTE' | 'SIN DATO'
costo_pago       number (si el costo venía como número = pagado)
costo_pendiente  bool (si el costo venía como texto = pago pendiente)
plan             'SI' | 'NO' | 'SIN DATO'
monto            number (valor del plan aperturado)
cxc              number (cuenta por cobrar)
padecimiento     string libre (texto del CRM)
servicio         string — solo GERONTOLOGIA la trae hoy ("Consulta Inicial Gerontologia"...); '' en los demás canales (ver §5d)
padGrp           string — se agrega en runtime (annotatePad) con el clasificador
```

**Definiciones del embudo (CLAVE — no cambiar sin avisar):**

| Etapa      | Definición en código                         |
|------------|----------------------------------------------|
| Lead       | cada fila (`recs.length`)                    |
| Agendado   | fila con `fecha` (helper `hasCita`)          |
| Efectivo   | `asiste === 'SI'`                            |
| Plan       | `plan === 'SI'`                              |

Tasas: **agendamiento** = agendados/leads · **asistencia** = efectivos/agendados · **cierre** = planes/efectivos.

> Nota importante: en `COMERCIAL_JULIO.xlsx` **todas las filas tienen fecha de cita**, o sea la base
> son puros agendados → la tasa de agendamiento sale **100%**. Cuando el Excel del mes incluya también
> los leads que NO agendaron (filas sin fecha de cita) o una columna de leads, la tasa real (~15%)
> aparecerá sola. La estructura ya está lista para eso.

## 5. El Excel que alimenta (`parseWorkbook`)

`parseWorkbook(wb)` soporta 2 formatos de archivo:

**Formato nuevo (desde 2026-07):** una sola hoja llamada exactamente `BASE DE PACIENTES` con los
pacientes de los 4 canales juntos. El canal de cada fila se **detecta por texto** en el comentario
(columna `PADECIMIENTO`), con `detectCanalFromPad(pad)`:

- si el comentario menciona `GOOGLE` → canal GOOGLE
- si menciona `PROMOCION` (cualquier variante de "promociones") → canal PROMOCIONES
- si menciona `ORGANIC` (cualquier variante de "orgánico") → canal ORGANICO
- **si no menciona ninguno → canal FACEBOOK** (Meta). Regla explícita de Irvin (2026-07-01):
  "si no dice nada las citas pertenecen a Facebook".

Es una búsqueda de palabra simple, a propósito (así lo pidió Irvin — sin exigir una estructura fija
en el comentario). Ojo: esto puede dar falsos positivos si el costo/paquete del tratamiento incluye
la palabra "PROMOCIONES" en su nombre (p. ej. `"590+POSTUR+PROMOCIONES"`) sin ser realmente un lead
de ese canal — es un trade-off aceptado a propósito por simplicidad, no un bug.

**Formato viejo:** una hoja por canal, nombre tipo `BASE DE PACIENTES ... FACEBOOK` /
`... PROMOCIONES` / `... GOOGLE` / `... ORGANICO` (regex, sin importar mayúsculas). Se usa como
fallback si no existe la hoja unificada `BASE DE PACIENTES`.

En ambos formatos, dentro de la hoja se localiza el renglón de encabezados (el que contiene
`NOMBRE`) y se mapean columnas por texto: `DIA`, `NOMBRE`, `APELLIDO` (opcional — si existe se
concatena con NOMBRE), `NUMERO`, `FECHA DE AGENDA`, `SEDE`, `ASISTE`, `COSTO`, `PLAN`, `MONTO`,
`CXC` (o `CUENTA`), `PADECIMIENTO`.

> Las hojas `FACEBOOK`/`PROMOCIONES`/`GOOGLE`/`ORGANICO` en el archivo actual **ya no son bases de
> pacientes** — son hojas de rendimiento/presupuesto de pauta (leads totales, presupuesto gastado;
> Facebook además viene desglosada por sucursal con CAC, CPL, % agendadas/efectivas/asistencia).
> El dashboard todavía no las consume — quedan pendientes de decidir si se integran (ver §12).

En el formato viejo, si las hojas de canal llegan a ser copias espejo exactas, `detectMirrors()` las
detecta y el Consolidado deduplica para no contar triple. Con el formato nuevo esto no aplica (ya es
una sola hoja), por eso la higiene de duplicados pasa a `excel_to_dat.js` (ver §5b).

## 5b. Higiene entre canales (`excel_to_dat.js` → `applyChannelRules`)

Como el canal ahora se decide por texto (o, en el formato viejo, por en qué hoja cae la fila), un
mismo paciente puede terminar contado en dos canales por error de captura (p. ej. una fila sin
mención de canal → Facebook, y otra fila del mismo paciente con "GOOGLE" en el comentario). Eso se
cuenta doble en el Consolidado si no se corrige. `excel_to_dat.js` corrige esto **antes** de escribir
`pacientes.dat`, en este orden:

1. **Regla fija:** cualquier registro `GOOGLE` con `sede === 'MIXQUIAHUALA'` se reclasifica solo a
   `FACEBOOK` (Irvin, 2026-07-01: así se maneja siempre esa sede en Google).
2. **Regla fija:** si un paciente está en `ORGANICO` y también en `FACEBOOK` (mismo número+nombre+
   sucursal), se elimina solo de FACEBOOK (ORGANICO manda) — sin preguntar.
3. **Detección de duplicados entre canales restantes:** agrupa registros por `nombre` + `numero` +
   `sede` normalizados (número solo dígitos, nombre en mayúsculas). Si la misma combinación aparece
   en más de un canal:
   - si ya existe una resolución en **`channel_overrides.json`** (array de
     `{numero, nombre, sede, canal, nota}`), se aplica sola: se queda solo el registro del canal
     correcto y se descarta el resto — no se cuenta doble.
   - si no hay resolución todavía, **no se borra nada**: se dejan ambos registros tal cual y se
     imprime un reporte en consola (`ATENCION · N paciente(s)...`) con nombre, número, sede y en qué
     canales aparece, para resolverlo a mano.
4. Casos con nombre+sede iguales pero **sin número** para confirmar el match se dejan tal cual y se
   avisan aparte (`AVISO ·`), no se tratan como duplicado automático (no hay forma de confirmarlo).

**Flujo para resolver un duplicado reportado:** cuando `node excel_to_dat.js` marca un paciente,
Irvin indica a qué canal pertenece de verdad → se agrega una entrada a `channel_overrides.json` →
se vuelve a correr `npm run update`. La resolución queda guardada, así que si ese mismo paciente
reaparece en un mes futuro ya no se vuelve a preguntar.

## 5c. Presupuesto, leads reales, CAC y proyección (`adspend.dat` + pestaña "Presupuesto")

Añadido 2026-07-01. Antes el dashboard no podía calcular CAC ni un agendamiento real porque
`pacientes.json`/`.dat` solo trae gente que **ya agendó** (ver §4) — no había forma de saber cuántos
leads totales entraron. Ahora el Excel trae hojas de pauta con esos números:

- **Hoja `FACEBOOK`**: viene en bloques repetidos (encabezado `SUCURSAL/META DE PACIENTES/META
  LEADS/PP GASTADO/LEADS/CPL/FRECUENCIA` + filas de sucursal + fila `TOTAL`), uno por grupo. Trae
  desglose real por sucursal.
- **Hojas `PROMOCIONES`/`GOOGLE`/`ORGANICO`**: solo `LEADS`/`PRESUPUESTO` en agregado (sin
  desglose por sucursal), y hoy sin datos capturados (0).

`extractAdSpend(wb)` en `excel_to_dat.js` las parsea a `adspend.dat`:
```
{ FACEBOOK:{ bySede:{ BALBUENA:{metaPacientes,metaLeads,gastado,leads,cpl}, ... }, total:{...} },
  PROMOCIONES:{ total:{leads,gastado} }, GOOGLE:{...}, ORGANICO:{...} }
```
`build.py`/`build.js` lo inyectan en el placeholder `const RAW_ADSPEND = __ADSPEND__;` de la
plantilla (junto al de `RAW_RECORDS`).

**Actualizado 2026-07-02:** el botón "Subir Excel" del navegador **también** parsea presupuesto
ahora — `extractAdSpendBrowser(wb)` (dashboard_template.html) es una copia funcional de
`extractAdSpend` para que quien suba su Excel directo en el navegador (sin correr `excel_to_dat.js`)
tenga la pestaña Presupuesto completa igual. `ADSPEND` pasó de `const` a `let` para poder
reasignarse ahí. **Mantener ambas copias en sync** al tocar la lógica de presupuesto (mismo patrón
que `parseWorkbook`, ver §5). Lo que el navegador **no** replica todavía: las reglas fijas
(Mixquiahuala→Facebook, Orgánico gana sobre Facebook) ni el reporte de duplicados
entre canales — esas solo corren en `excel_to_dat.js`.

En el dashboard, `adspendView(canal, sedeSet)` (dashboard_template.html) sirve leads/gasto reales
respetando el filtro de canal/sede — para FACEBOOK puede sumar por sucursal seleccionada; para los
otros 3 canales siempre es el agregado del canal completo (no hay desglose que filtrar). Con eso:

- **Agendamiento real** = agendados / leads reales (ya no agendados/filas de la base, que siempre
  daba 100%).
- **CAC** = gasto en pauta / citas efectivas (asistieron). Fórmula confirmada con Irvin (2026-07-01).
- **Efectividad sobre leads** = efectivos / leads reales.

> **Importante (2026-07-01, corregido tras feedback de Irvin):** los leads reales NO viven solo en
> la pestaña Presupuesto — `kpis(recs, realLeads)` ahora acepta un segundo parámetro opcional que
> reemplaza `recs.length` como denominador de leads, y `render()` le pasa
> `adspendView(state.canal, state.sedes).leads`. Esto corrige el KPI "Leads (contactos)" y el %
> de agendamiento en **Resumen** (embudo, tarjetas KPI) — antes solo se veía en Presupuesto y el
> resto del dashboard seguía mostrando el conteo de filas (el bug que Irvin reportó como "sigo
> viendo los leads equivocados"). `sedeAgg(base)` recibió el mismo tratamiento vía
> `sedeRealLeads(sede, canalRows)`: para sedes que son 100% Facebook usa `adspend.FACEBOOK.bySede`;
> si la vista mezcla canales (Consolidado), suma Facebook real + conteo de filas para los canales
> sin desglose por sede; si la sede no tiene ningún registro de Facebook, cae de vuelta al conteo
> de filas. Esto alimenta la tabla de Sucursales (columnas Leads/% Agend).

**Proyección de cierre de mes** (`monthProjection(recs)`): usa la fecha real del navegador (hoy) como
corte — Irvin confirmó (2026-07-01) que llena la columna `FECHA DE AGENDA` **día a día, al finalizar
el día** (hoy carga las citas de hoy, mañana las del día 2, etc.), así que el día de hoy ya cuenta
completo, no hay que restar un día. Cuenta agendados/efectivos/planes del mes en curso hasta hoy,
saca el ritmo diario (`total/díasTranscurridos`) y proyecta a fin de mes (`ritmo × díasDelMes`,
usando `daysInMonth()` real del mes — 31 para julio, no hardcodeado). Se muestra en la pestaña
**Presupuesto**, debajo de las tarjetas de leads/CAC.

> Los leads/gasto de Facebook por sucursal usan los mismos códigos cortos que `TIERS`
> (normalizados con `normSede`, ver §6) — si el nombre de una sucursal nueva no tiene un prefijo ya
> contemplado (`CLINICA`, `EQUILIBRIO TOTAL`, `FSH`), no va a calzar y quedará fuera del desglose.

> **`asISO` también convierte fechas de texto** (`"01/07/2026"` en vez de una fecha real de Excel) —
> a veces la celda de `FECHA DE AGENDA`/`DIA` llega como texto plano en formato `DD/MM/AAAA` en lugar
> de una fecha de Excel; sin esto, `monthProjection`/`inMonth` fallaban silenciosamente (Invalid
> Date) para esas filas y las excluían de la proyección sin avisar.

> **`normSede` también limpia texto de directorio pegado por error**: alguna vez una celda de `SEDE`
> trae algo como `"Equilibrio total | Nicolás Romero | Fisioterapia & Rehabilitación"` (texto de un
> anuncio, no solo el nombre). `normSede` detecta el `|` y toma el primer segmento no vacío como
> nombre de sede (después de quitar los prefijos conocidos).

## 5d. Canal GERONTOLOGIA (agregado 2026-07-06)

Irvin agregó un servicio nuevo (gerontología) con su propia hoja de pacientes, estructuralmente
distinta a las demás:

- **`BASE DE GERONTOLOGIA`**: hoja de pacientes aparte (no entra en la hoja unificada `BASE DE
  PACIENTES`). Columnas propias: `NOMBRE`, `APELLIDO`, `NUMERO`, `FECHA DE AGENDA`, **`SERVICIO`**
  (ej. `"Consulta Inicial Gerontologia"`, `"Clase baile gerontología"`) en vez de `SEDE`/`PADECIMIENTO`,
  `ASISTE`, `COSTO INICIAL` (puede venir texto tipo `"NO HAY PAGO"` — se maneja igual que en las
  demás bases), `PLAN`, `MONTO`, `CXC`. **No trae `SEDE` ni `DIA`.**
- **`GERONTOLOGIA`**: hoja de presupuesto agregado (`LEADS`/`PRESUPUESTO`), mismo patrón que
  `PROMOCIONES`/`GOOGLE`/`ORGANICO`.

`parseWorkbook` (excel_to_dat.js y dashboard_template.html) busca `BASE DE.*GERONTOLOG` **siempre**,
sin importar si el archivo usa el formato unificado o el viejo por canal — es una hoja adicional,
independiente, con canal fijo `'GERONTOLOGIA'` para todas sus filas (no se detecta por texto).
`extractPatientRows` ya rellena los huecos con su default normal (`sede:'SIN SEDE'`, `dia:null`)
sin romper nada — **gerontología no tiene sucursal**, por diseño; cae en "Otras / sin grupo" en la
tabla de Sucursales y no aparece en el desglose por sede de Presupuesto.

**Campo nuevo `servicio`** (string, `''` por default en los demás canales): se agrega a todo
registro vía `col('SERVICIO')` en `extractPatientRows`. A diferencia de `padecimiento` (texto libre
que necesita el clasificador `PAD_GROUPS`), `servicio` ya viene limpio del Excel, así que se agrupa
por **valor exacto** con `servicioAgg(base)` — sin clasificador. `renderServicio(base)` pinta el
panel **"Por servicio"** en la pestaña Resumen (reutiliza el CSS `.padrow`/`.ptrack`/`.pfill` de
Padecimientos); el panel se **oculta solo** (`display:none`) si la vista actual no tiene ningún
registro con `servicio` (o sea, para Facebook/Promociones/Google/Orgánico no aparece).

`GERONTOLOGIA` se agregó también a: `segCanal` (botón + `--c-geronto`), `detectMirrors`,
`adspendView`'s lista de canales para Consolidado. El resto (KPIs, embudo, Ranking, Sucursales)
lo toma solo porque son genéricos sobre `state.canal`/`recsForCanal` — no necesitaron cambios.

## 6. Divisiones (tiers) — array `TIERS`

- **CORPORATIVO** (#19C2A8): BALBUENA, CHALCO, ECATEPEC, NEZA, PLAZA NEZA, MILPA ALTA, MIXQUIAHUALA, TLAHUAC, COACALCO
- **FRANQUICIAS** (#5B8DEF): AJUSCO, CLAVERIA, LA MODERNA, VALLE DORADO, PACHUCA, NICOLAS ROMERO, CUAUTITLAN
- **TERCERIZADAS** (#F178B6): CUAUTLA, QUERETARO, SAN JUAN DEL RIO, TEPEYAC, XOCHIMILCO, MIXQUIAHUALA
- **SATELITE** no está en ningún tier → cae en "Otras / sin grupo".
- MIXQUIAHUALA está definida pero sin datos en el archivo actual (aparecerá cuando haya registros).

`tierOf(sede)` devuelve el tier de una sede.

> **Bug corregido 2026-07-01:** el Excel nuevo trae el nombre completo de la sucursal (`"Clínica
> Equilibrio Total Balbuena"`, `"Clínica FSH Mixquiahuala"`, `"Equilibrio total Nicolás Romero"`)
> en vez del código corto. `normSede()` ahora quita los prefijos conocidos (`CLINICA`,
> `EQUILIBRIO TOTAL`, `FSH`, en cualquier combinación) y renombra casos especiales
> (`NEZAHUALCOYOTL`→`NEZA`, `PLAZA NEZAHUALCOYOTL`→`PLAZA NEZA`, `MODERNA`→`LA MODERNA`) antes de
> aplicar `SEDE_FIX`. Sin esto, ninguna sede calzaba con `TIERS` y la tabla de sucursales/ranking
> se veían vacíos o todo caía en "sin grupo". Si aparece una sucursal nueva con un prefijo distinto,
> hay que agregarlo a la lista de prefijos en `normSede` (está en `excel_to_dat.js` y en
> `dashboard_template.html`, deben coincidir).

## 7. Mapa de funciones (dónde está cada cosa)

Todo el JS está en el único `<script>` del final. Funciones clave:

**Datos y utilidades**
- `normSede`, `titleCase`, `stripAcc`, `hexA`, `asISO`, `fmtDate`, `animNum`, `pct`, `asMoney`, `nf`
- `recsForCanal(canal)` → registros del canal (Consolidado dedup­lica espejos)
- `detectMirrors()` → detecta canales espejo
- `selSedes(recs)` → aplica el filtro global de sedes (multi-select)
- `hasCita(r)`, `agendCount(recs)`

**KPIs y agregados**
- `kpis(recs, realLeads?)` → objeto con leads, agendados, efectivos, planes, tasas, ingresos, ticket,
  cxc, etc. `realLeads` (de `adspendView`) reemplaza `recs.length` como leads cuando hay dato real.
- `sedeAgg(base)` → agrega por sede (+ divKey, salud-inputs, ticket); usa `sedeRealLeads` para el
  campo `leads` real por sucursal cuando hay Facebook (ver §5c); usa `sedeMetaInfo`/`enMesActual`
  para meta/ritmo/déficit/proyección del mes (ver §8b)
- `divAgg(rows)` → subtotales por división (incluye meta/proyección agregadas)
- `salud(s)` → semáforo (score 0-100 + status + métrica más débil). Metas en `TARGETS`.
- `monthCutoffInfo()` / `enMesActual(r,ci)` → corte compartido del mes en curso (hoy cuenta
  completo), usado por `monthProjection` y por la meta de sucursal

**Render (una función por bloque visual)**
- `render()` → orquesta TODO. Se llama en cada cambio de filtro. Lee `selSedes(recsForCanal(canal))`.
- `renderFunnel(k)`, `renderKpis(k)`, `renderDonut(k)`
- `renderSede(base)` + `renderSedeBars` + `sedeRowHtml` + `divRowHtml` (tabla agrupada por división con semáforo y TOTAL GENERAL)
- `renderPad(base)` + `padAgg` + `padGroupKey` (clasificador de padecimientos, 17 grupos + OTRO)
- `renderPatients(base)` (tabla de pacientes, chips, búsqueda, color por división)
- `renderFocos(base)` (focos rojos: sedes ≥4 agendados, no verde, top 5 por urgencia)
- `renderPresupuesto(recs,k)` + `adspendView(canal,sedeSet)` + `monthProjection(recs)` (leads
  reales/CAC/CPL + proyección de cierre de mes, ver §5c)
- `renderRanking(recs)` + `rankBarsHtml(rows,valueKey,fmt)` (5 comparativas por sucursal —
  iniciales/agendados, % asistencia, % conversión, % cierre, cuenta por cobrar — coloreadas por
  división. Reemplazó al mapa 3D, ver §11)

**Controles**
- `buildSedeControl` / `syncSedeUI` / `setSedeFilter` (multi-select de sedes + botones de tier)
- `setTab(t)` + handler de `#tabbar` (navegación por pestañas)
- `state` = objeto global de estado: `{canal, sedes:Set, search, chip, padFilter, sedeSort, patSort, padSort}`

**Efectos**
- Tilt 3D de tarjetas KPI: IIFE con listener `mousemove` sobre `#kgrid`.

## 8. Semáforo de salud (`salud` + `TARGETS`)

```
TARGETS = { sched: .30, asis: .65, cierre: .30 }   // metas
score = 100 * ( 0.35*min(agendamiento/.30,1)
              + 0.30*min(asistencia/.65,1)
              + 0.35*min(cierre/.30,1) )
status = score>=80 ? 'verde' : score>=55 ? 'amarillo' : 'rojo'
```

Se usa en: focos rojos y punto/pastilla de semáforo en la tabla de sucursales.

## 8b. Meta del mes por sucursal (tabla de Sucursales, agregado 2026-07-06)

Pedido de Irvin: en la tabla de Sucursales, ver quién está más lejos de su meta, con un semáforo
propio (distinto del semáforo de salud de `salud()`). Dos columnas nuevas junto a "Agendados":
**Meta del mes** (`lleva/meta` + punto de semáforo) y **Proy. fin de mes**.

La meta viene de `META DE PACIENTES` en `adspend.dat` (`metaForSede(sede)` — hoy solo Facebook la
trae por sucursal; sedes sin ese dato muestran `—` en vez de un semáforo). La fórmula
(`sedeMetaInfo` en dashboard_template.html):

```
ritmoNecesario = meta / díasDelMes
esperadoHoy    = ritmoNecesario × díasTranscurridos   // lo que le tocaría llevar HOY, no la meta total
lleva          = agendados de ESTE mes a la fecha (enMesActual) — no el historial completo
déficit        = lleva − esperadoHoy                  // negativo = va atrasado respecto al ritmo
ritmoActual    = lleva / díasTranscurridos
proyección     = round(ritmoActual × díasDelMes)
metaRatio      = lleva / esperadoHoy
semáforo       = metaRatio>=1 ? verde : metaRatio>=0.8 ? amarillo : rojo
```

**Por qué el déficit es contra "lo esperado a hoy" y no contra la meta total:** así se ve quién va
mal *ahora*, a mitad de mes, en vez de que todas las sucursales salgan "en déficit" simplemente
porque aún no termina el mes. El detalle completo (ritmo necesario + déficit) sale en el `title`
(tooltip) del punto de semáforo y del número, para no saturar la celda.

Igual que en `monthProjection` (§5c), "hoy" cuenta completo (Irvin llena el Excel día a día, así
que no se resta un día al corte). La fila TOTAL GENERAL y las filas de subtotal por división suman
`meta`/`lleva` de sus sucursales y recalculan ritmo/proyección/semáforo sobre esa suma (no promedian
los semáforos individuales).

## 9. Pestañas (6) — cada una es un `<section class="tabpanel" data-panel="X">`

1. **resumen** — focos rojos + embudo + KPIs (con tilt 3D) + gráficas (barras + dona)
2. **ranking** — 5 comparativas por sucursal (iniciales, % asistencia, % conversión, % cierre,
   cuenta por cobrar), coloreadas por división. Reemplazó al mapa 3D (ver §11).
3. **presupuesto** — leads reales/gasto/CPL/CAC (via `adspend.dat`, ver §5c) + proyección de cierre de mes
4. **sucursales** — tabla agrupada por división, subtotales, TOTAL GENERAL, semáforo
5. **padecimientos** — clasificador + tarjetas + barras + tabla; clic filtra la base y salta a Pacientes
6. **pacientes** — base completa, chips (plan/no asistió/pendiente/cxc), búsqueda, color por división

> El simulador de impacto se removió (petición de Irvin, 2026-07-01). Si se vuelve a pedir, revisar
> el historial de `dashboard_template.html` para recuperar `SIM`, `simBaseline`, `projFunnel`,
> `renderSimOut`, `simResetToBase`, `ensureSim` y el CSS `.simwrap`/`.simpanel`/etc.

## 10. Convenciones / estilo (RESPETAR)

- **Voz del producto**: español mexicano energético, minúsculas, formato mínimo. (Preferencia del usuario, Irvin.)
- Un solo archivo auto-contenido; sin framework; JS vanilla.
- Offline-first; solo el mapa necesita internet (con fallback claro).
- **Sin localStorage** (se removió intencionalmente).
- Design tokens en `:root` del `<style>`. Tipografías: Space Grotesk (display), Plus Jakarta Sans (body), Space Mono (mono).
- Al agregar HTML, mantener balance de `<div>`/`<section>`. Al editar JS, validar con `node --check` sobre el `<script>` extraído.

## 11. Limitaciones conocidas

- Base de pacientes = solo agendados (ver §4); el agendamiento real ya no sale 100% gracias a los
  leads reales de `adspend.dat` (ver §5c) — pero si un canal/sede no tiene leads reales cargados
  (Google/Orgánico hoy), su % de agendamiento vuelve a caer al 100% falso (fallback a filas).
- **Mapa 3D removido** (petición de Irvin, 2026-07-03) — se reemplazó por la pestaña **Ranking**
  (5 comparativas por sucursal coloreadas por división, ver §7/§9). Si se vuelve a pedir un mapa,
  revisar el historial de `dashboard_template.html` para recuperar `SEDE_COORDS`, `ensureMap`,
  `buildMapData`, `sedeLayer`, `mapTooltip`, `updateMap`, el CSS `.mappanel`/`.mapwrap`/etc., y los
  `<script>`/`<link>` de MapLibre + deck.gl en el `<head>`.
- **CAC ya se calcula** (implementado 2026-07-01, ver §5c y pestaña Presupuesto): usa `adspend.dat`
  (gasto real por canal, Facebook con desglose por sucursal) + citas efectivas de la base de
  pacientes. Las hojas `PROMOCIONES`/`GOOGLE`/`ORGANICO` hoy no traen datos capturados (0), así que
  su CAC/leads reales saldrán en 0/— hasta que se llenen.
- **Proyección de cierre de mes**: asume que el ritmo de captura ha sido parejo en lo que va del
  mes — no corrige por estacionalidad (ej. fin de semana vs entre semana) ni por rampa de una
  campaña nueva a mitad de mes. Es una proyección lineal simple a propósito.

## 12. Roadmap propuesto (ideas, NO construidas aún)

- **Comparativo mes vs mes** — cargar 2 Excels y mostrar flechas ↑↓ por sede/KPI.
- **Modo presentación / pantalla completa** — para juntas con dirección.
- **Heatmap sede × KPI**.
- **Exportar a PDF ejecutivo** (one-pager).
- **CAC/leads reales por sucursal en Promociones/Google/Orgánico** — el parser (`parseAggregateAdSheet`)
  ya está listo para leer un desglose por sede en cuanto esas 3 hojas lo traigan; hoy solo dan un
  total agregado por canal.

## 13. Patrón para agregar una feature nueva

1. **Nueva pestaña**: agrega un `<button class="tab" data-tab="x">` en `#tabbar` y una
   `<section class="tabpanel" data-panel="x">…</section>`. En el handler de `#tabbar` puedes
   inicializar algo perezoso (como el mapa) con `if(t==='x') ...`.
2. **Nueva métrica**: extiende `kpis(recs)` y/o `sedeAgg(base)`; úsala en el render correspondiente.
3. **Nuevo bloque visual**: crea `renderX(base)` y llámalo dentro de `render()` (que ya calcula
   `base = recsForCanal(state.canal)` y `recs = selSedes(base)`).
4. Todo reacciona al filtro global porque `render()` corre en cada cambio de canal/sede y cada
   `renderX` filtra con `selSedes(...)`.

## 14. Compartir con el equipo (decisión 2026-07-03: sin GitHub Pages)

Se probó publicar el dashboard en GitHub Pages (repo `centro-de-mando-comercial` en la cuenta de
Irvin) para tener un link único que el equipo solo recargara. Se descartó por completo — el repo
y el sitio de Pages **se borraron** — porque:

- GitHub Pages es gratis solo si el sitio es **público** (cualquiera con el link lo ve).
- GitHub Pro permite activar Pages desde un repo privado, pero **no** restringe el sitio publicado
  a colaboradores — eso solo existe en GitHub Enterprise Cloud (confirmado con la documentación
  oficial de GitHub). Irvin pagó Pro pensando que sí, se le explicó el error y canceló.
- Publicar datos reales de pacientes (nombre, teléfono, padecimiento) en un link público es un
  riesgo legal real (datos de salud, sensibles bajo la LFPDPPP) — se descartó esa vía aunque Irvin
  la consideró en el momento.

**Decisión final de Irvin:** seguir compartiendo `Centro_de_Mando_Comercial.html` manualmente
(WhatsApp, correo, o la carpeta de OneDrive donde ya vive el proyecto) cada vez que actualiza.
Sin link web, sin hosting, sin costo. Si en el futuro se retoma la idea de un link compartido,
la única opción gratis viable que sí cumple "Irvin actualiza, el equipo solo refresca, nadie más
entra" es **Cloudflare Pages + Cloudflare Access** (gratis hasta 50 usuarios) — no se llegó a
configurar. No reabrir la vía de GitHub Pages para esto, ya se descartó con evidencia.

---

_Generado como handoff para continuar en Antigravity. Origen de datos: `COMERCIAL_JULIO.xlsx`._
