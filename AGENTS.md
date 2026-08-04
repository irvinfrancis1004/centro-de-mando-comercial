# AGENTS.md — Centro de Mando Comercial · Equilibrio Total

Contexto para agentes de IA (Antigravity / Cursor / Windsurf) y para el equipo.
Léelo completo antes de tocar código.

---

## 1. Qué es esto

Un **dashboard comercial de una sola página HTML, auto-contenido**, para la red de clínicas
de rehabilitación **Equilibrio Total** (22 sedes en 3 divisiones). Diagnostica el embudo
operativo **Leads → Agendados → Efectivos** por canal, división y sucursal (sin cifras de dinero,
ver §4), con foco en citas, padecimientos, horarios pico y metas — e incluye la pestaña **Horarios y
Áreas** (qué franja concentra más citas y a qué área — Acupuntura/Fisioterapia/Quiropráctica —
llegan, con alertas de desequilibrio, ver §5g), semáforo de salud, focos rojos, alertas de la semana
y presupuesto/CAC por canal. **No tiene pestaña de ranking** — se quitó a petición de Irvin (2026-08-01,
reiterado 2026-08-03: "no me sirve de mucho"), ver §9 y §11.

- **Funciona sin conexión** (offline-first). La única parte que necesita internet es el botón
  **Subir Excel** (carga SheetJS desde CDN).
- **Sin framework**: HTML + CSS + JavaScript vanilla, todo en un archivo.
- **No usa localStorage** ni backend. Todo el estado vive en memoria durante la sesión.

## 2. Estructura del proyecto

> **Multi-mes desde 2026-08-01** (ver §15 para el detalle completo): cada mes vive en su propia
> carpeta de datos y genera su propio HTML. `Centro_de_Mando_Comercial.html` (el archivo que se
> abre con doble clic / se comparte) dejó de ser el dashboard directo — ahora es una pantalla de
> **selección de mes** generada por `build_selector.js`.

```
centro-de-mando/
├── AGENTS.md                                ← este archivo
├── README.md                                ← guía corta para humanos
├── months.js                                ← helper compartido: lee/escribe months.json (ver §15)
├── months.json                              ← registro de meses (mes -> Excel fuente, congelado o no); autogenerado, NO se sube
├── excel_to_dat.js                          ← Excel -> data/<MES>/pacientes.dat (Node, replica parseWorkbook + higiene de canales)
├── channel_overrides.json                   ← resoluciones manuales de duplicados entre canales (ver §5b)
├── build.py                                 ← DESACTUALIZADO desde el cambio multi-mes (ver §15) — no lo uses, usa build.js
├── build.js                                 ← data/<MES>/*.dat -> Centro_de_Mando_Comercial_<MES>.html (+ regenera el selector)
├── build_selector.js                        ← genera Centro_de_Mando_Comercial.html (la pantalla de selección de mes, ver §15)
├── build_pages.js                           ← genera docs/index.html (link público, SOLO el mes activo, sin selector)
├── package.json                             ← dependencia `xlsx` (SheetJS) + scripts npm
├── dashboard_template.html                  ← FUENTE que se edita (placeholders __DATA__, __ADSPEND__, __MES_LABEL__, etc. — ver §15)
├── data/
│   ├── JULIO/pacientes.dat, adspend.dat     ← datos de Julio, CONGELADOS (frozen:true en months.json), NO se suben a GitHub
│   └── AGOSTO/pacientes.dat, adspend.dat    ← datos vigentes de Agosto, se regeneran con cada Excel nuevo, NO se suben a GitHub
├── Centro_de_Mando_Comercial.html           ← SALIDA: selector de mes (lo que se abre con doble clic), NO se sube a GitHub
├── Centro_de_Mando_Comercial_JULIO.html     ← SALIDA: dashboard de Julio (congelado), NO se sube a GitHub
├── Centro_de_Mando_Comercial_AGOSTO.html    ← SALIDA: dashboard de Agosto (vigente), NO se sube a GitHub
└── COMERCIAL_JULIO.xlsx                     ← Excel de origen viejo (semilla inicial, ya no es la fuente real de Julio — ver §15)
```

**Regla de oro:** se edita `dashboard_template.html`. Todo lo que está bajo `data/` y los
`Centro_de_Mando_Comercial*.html` son generados — no los edites a mano, se sobrescriben al construir.

## 3. Cómo actualizar los datos y construir

Pipeline de 2 pasos, pensado para que cada mes solo haga falta reemplazar el Excel. **Desde
2026-08-01 cada comando necesita saber de qué mes hablas** (ver §15 para el sistema completo) —
si solo hay un mes sin congelar (el "mes activo"), lo adivina solo y puedes omitirlo:

```bash
node excel_to_dat.js                               # usa el mes activo (el único no congelado)
node excel_to_dat.js AGOSTO                         # usa el Excel ya guardado para ese mes
node excel_to_dat.js AGOSTO "ruta\al\excel.xlsx"    # apunta AGOSTO a un Excel específico (lo recuerda)
node build.js                                       # construye TODOS los meses + el selector (no requiere Python)
node build.js AGOSTO                                # construye solo ese mes (y de todos modos refresca el selector)
```

O en un solo paso: `npm run update` (corre `excel_to_dat.js` + `build.js`, ambos sin mes = mes
activo). También existen `npm run dat`, `npm run build` y `npm run selector`.

`build.py` (Python) **quedó desactualizado** con el cambio multi-mes — no sabe de `data/<MES>/`
ni de `months.json`. No lo uses hasta que se porte (no se ha portado a propósito: nadie en el
equipo depende de la ruta Python hoy, todo corre con Node). `excel_to_dat.js` requiere Node + el
paquete `xlsx` (ya declarado en `package.json`; `npm install` si falta `node_modules`).

Luego abre `Centro_de_Mando_Comercial.html` con doble clic (no necesita servidor) — te deja elegir
el mes y de ahí entras al dashboard real.

El flujo completo es: `excel_to_dat.js` parsea el Excel exactamente igual que `parseWorkbook()`
(la función que corre en el navegador al usar "Subir Excel" — mismo código, portado a Node) y
escribe `data/<MES>/pacientes.dat` (JSON). `dashboard_template.html` contiene la línea
`const RAW_RECORDS = __DATA__;`; `build.js` reemplaza `__DATA__` por ese JSON (y de paso
`__MES_LABEL__`/`__MES_STATUS__`/`__FUENTE_LABEL__` con los datos de ese mes, ver §15). Así cada
`Centro_de_Mando_Comercial_<MES>.html` queda auto-contenido.

> Para editar el estilo/lógica: trabaja en la plantilla, corre `node build.js` (construye todos los
> meses), refresca el navegador. Para probar rápido sin build: también puedes abrir cualquier
> `Centro_de_Mando_Comercial_<MES>.html` ya generado y editar ahí directo (es el mismo código, solo
> que con los datos pegados) — pero recuerda que si tocas la plantilla, el siguiente `build.js`
> sobrescribe esos cambios manuales.
>
> **Para actualizar los datos del mes vigente sin usar "Subir Excel" en el navegador:** corre
> `npm run update` (usa el mes activo automáticamente) o `node excel_to_dat.js AGOSTO "ruta.xlsx"`
> seguido de `node build.js AGOSTO` si quieres apuntar a otro Excel.

## 4. Modelo de datos

Cada registro (fila del Excel, ya limpio) es un objeto:

```
canal            'FACEBOOK' | 'PROMOCIONES' | 'GOOGLE' | 'ORGANICO' | 'GERONTOLOGIA'
nombre           string
numero           string (teléfono)
fecha            fecha ISO de la CITA (fecha de agenda). Su presencia define "agendado".
hora             'HH:MM' de la cita, o null — viene de la misma celda que fecha (ver §5g)
sede             string en MAYÚSCULAS (normalizada); 'SIN SEDE' si el canal no la trae
asiste           'SI' | 'NO' | 'PENDIENTE' | 'SIN DATO' — real solo para GERONTOLOGIA (ver más abajo)
especialidad     string libre — 'ACUPUNTURA'/'FISIOTERAPIA'/'QUIROPRACTICA'..., '' si no capturada (ver §5g)
padecimiento     string libre (texto del CRM)
servicio         string — solo GERONTOLOGIA la trae hoy ("Consulta Inicial Gerontologia"...); '' en los demás canales (ver §5d)
padGrp           string — se agrega en runtime (annotatePad) con el clasificador
```

> **Cambio 2026-08-01 (Irvin reestructuró el Excel):** `BASE DE PACIENTES` dejó de traer `DIA`,
> `ASISTE`, `COSTO INICIAL`, `PLAN`, `MONTO`, `CXC` — a propósito ("quité la parte de cuentas por
> cobrar del archivo y dejé padecimientos"). Esos campos **ya no se extraen** (no solo se ocultan,
> como en el cambio del §4 de arriba) porque ninguna hoja los trae ya, ni siquiera
> `BASE DE GERONTOLOGIA` (que sí sigue trayendo `ASISTE` real, es el único canal con esa columna
> todavía). A cambio, `BASE DE PACIENTES` ganó `ESPECIALIDAD` y `FECHA DE AGENDA` ahora trae fecha
> **y hora** — ver §5g. La hoja `FACEBOOK` ganó columnas `AGENDADOS`/`ASISTIDOS` por sucursal — ver
> §5c "Asistidos corregido". Al momento de este cambio, `AGENDADOS`/`ASISTIDOS`/`ESPECIALIDAD` están
> **100% vacías** en el Excel real — todo el código de abajo está listo para cuando se empiecen a
> llenar (degrada a "sin datos", no truena).

**Definiciones del embudo (CLAVE — no cambiar sin avisar):**

| Etapa      | Definición en código                         |
|------------|----------------------------------------------|
| Lead       | cada fila (`recs.length`), o leads reales de `adspend.dat` cuando hay (ver §5c) |
| Agendado   | fila con `fecha` (helper `hasCita`)          |
| Efectivo   | GERONTOLOGIA: `asiste === 'SI'` por fila · resto: Asistidos corregido por sucursal (ver §5c "Asistidos corregido") |

Tasas: **agendamiento** = agendados/leads · **asistencia** = efectivos/agendados · **conversión** =
efectivos/leads (lead que se vuelve paciente que sí llegó).

> **Cambio 2026-08-01 (petición de Irvin):** el dashboard ya no muestra la etapa "Plan" (aperturación
> de tratamiento) ni la tasa de "cierre" (planes/efectivos), ni ninguna cifra de dinero (ticket
> promedio, ingreso de consultas, valor de planes, cuenta por cobrar) — en ninguna pestaña. Motivo:
> Irvin quería un dashboard más operativo/clínico (citas, padecimientos, metas, % de agendamiento/
> asistencia/conversión) y la cuenta por cobrar en particular venía con datos poco confiables (casos
> donde CxC > Monto del plan). `plan`/`monto`/`cxc` ya ni siquiera se extraen del Excel (ver el otro
> cambio 2026-08-01 arriba — Irvin los quitó del archivo, no solo se dejaron de mostrar). La
> "Conversión" (efectivos/leads) reemplaza a "cierre" como métrica de eficiencia de punta a punta del
> embudo — es la tarjeta destacada del hero y aparece en KPIs y la tabla de Sucursales
> (columna "% Conversión", antes "% Efect/Leads", mismo dato).

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
`NOMBRE`) y se mapean columnas por texto: `NOMBRE`, `APELLIDO` (opcional — si existe se concatena
con NOMBRE), `NUMERO`, `FECHA DE AGENDA`, `SEDE`, `ASISTE`, `ESPECIALIDAD`, `PADECIMIENTO`. Desde
2026-08 `BASE DE PACIENTES` ya no trae `DIA`/`COSTO`/`PLAN`/`MONTO`/`CXC` (ver §4) — si el Excel
llegara a traer alguna de esas columnas otra vez, `col()` las encontraría solo si se vuelve a
mapear explícitamente, hoy no se busca.

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
  desglose real por sucursal. Desde 2026-08 también trae `AGENDADOS`/`ASISTIDOS` por sucursal (ver
  "Asistidos corregido" más abajo) — al momento de este cambio, vacías.
- **Hojas `PROMOCIONES`/`GOOGLE`/`ORGANICO`**: solo `LEADS`/`PRESUPUESTO` en agregado (sin
  desglose por sucursal), y hoy sin datos capturados (0).

`extractAdSpend(wb, records)` en `excel_to_dat.js` las parsea a `adspend.dat` (recibe `records` —
la lista ya deduplicada, post `applyChannelRules` — para poder calcular el Asistidos corregido):
```
{ FACEBOOK:{ bySede:{ BALBUENA:{metaPacientes,metaLeads,gastado,leads,cpl,agendadosRef,asistidosRaw,asistidos}, ... }, total:{...} },
  PROMOCIONES:{ total:{leads,gastado}, bySedeAsistidos:{BALBUENA:n,...} }, GOOGLE:{...}, ORGANICO:{...} }
```
`build.py`/`build.js` lo inyectan en el placeholder `const RAW_ADSPEND = __ADSPEND__;` de la
plantilla (junto al de `RAW_RECORDS`).

**Asistidos corregido por sucursal (agregado 2026-08-01):** desde que `BASE DE PACIENTES` perdió
`ASISTE` (ver §4), la única fuente de "cuántos asistieron" para los 4 canales de marketing es el
`ASISTIDOS` que el equipo captura a mano en la hoja `FACEBOOK` por sucursal — pero ese número junta
a todos los que asistieron en esa sucursal sin distinguir canal real (históricamente casi todo era
Facebook). `correctAsistidos(records, facebookBySede)` en `excel_to_dat.js` (mismo patrón que
`applyChannelRules`, reutiliza `r.canal` ya resuelto) corrige esto restando, por sucursal, la
cantidad exacta de pacientes que la clasificación por palabra clave (`detectCanalFromPad`) ya
identificó como Google/Promociones/Orgánico en esa misma sucursal, y les acredita esos mismos
conteos a ellos. **Ejemplo (pedido explícito de Irvin, 2026-08-01):** Facebook dice 100 asistidos en
Balbuena; de los pacientes de Balbuena, 20 tienen "ORGANICO" en su comentario y 10 "PROMOCIONES" →
Facebook queda en 70, Orgánico gana 20 y Promociones 10 en esa sucursal. Es una resta por **conteo
exacto**, no proporcional — así lo confirmó Irvin explícitamente. `AGENDADOS` de la hoja Facebook
queda solo como referencia (`agendadosRef`, guardado en `adspend.dat` pero sin UI todavía) — el
conteo de agendados sigue siendo por fila de `BASE DE PACIENTES` (`agendCount`/`hasCita`), no se
corrige con este mecanismo. **`GERONTOLOGIA` no participa** de esta corrección (no tiene desglose de
Facebook, sigue con `ASISTE` real por paciente, ver §5d).

En el dashboard, `realAsistidosView(canal, sedeSet)` (dashboard_template.html, mirror de
`adspendView`) suma `ADSPEND.FACEBOOK.bySede[sede].asistidos` (ya corregido) +
`ADSPEND[canal].bySedeAsistidos[sede]` para los otros 3 canales — a diferencia de `adspendView`,
esto SÍ es preciso por sucursal incluso para los canales sin desglose propio en el Excel (viene de
clasificar cada paciente, no de un agregado de toda la red), así que no necesita el `omitido`/aviso
que sí aplica a leads/gasto. `render()` pasa el resultado como 3er parámetro de `kpis(recs, realLeads,
realAsistidos)` — `null` cuando `state.canal==='GERONTOLOGIA'`, para que `kpis()` caiga a contar
`asiste==='SI'` por fila en ese caso. `sedeAgg(base)` usa el mismo criterio por sucursal vía
`sedeAsistidos(sede, canalRows)` (mirror de `sedeRealLeads`), decidiendo por grupo de sede si hay
`GERONTOLOGIA` en `_canalRows` (en cuyo caso cuenta por fila) o no (usa el agregado corregido).

**Actualizado 2026-07-02:** el botón "Subir Excel" del navegador **también** parsea presupuesto
ahora — `extractAdSpendBrowser(wb)` (dashboard_template.html) es una copia funcional de
`extractAdSpend` para que quien suba su Excel directo en el navegador (sin correr `excel_to_dat.js`)
tenga la pestaña Presupuesto completa igual. `ADSPEND` pasó de `const` a `let` para poder
reasignarse ahí. **Mantener ambas copias en sync** al tocar la lógica de presupuesto (mismo patrón
que `parseWorkbook`, ver §5). Lo que el navegador **no** replica todavía: las reglas fijas
(Mixquiahuala→Facebook, Orgánico gana sobre Facebook) ni el reporte de duplicados
entre canales — esas solo corren en `excel_to_dat.js`.

> **Historia del 2026-07-07** (Ajusco mostraba 1002 leads en vez de 119): `adspendView` sumaba los
> totales de **toda la red** de `PROMOCIONES`/`GOOGLE`/`ORGANICO` (agregados sin desglose por
> sucursal) encima del dato real de Facebook — 119 (Facebook Ajusco) + 841 (Promociones, toda la
> red) + 31 (Google) + 11 (Orgánico) = 1002. Primero se corrigió omitiendo esos 3 canales cuando
> había un filtro de sede activo, pero **Irvin pidió revertir eso el mismo día**: prefiere ver el
> total con esa imprecisión conocida (sabe que Promociones/Google/Orgánico son de toda la red, no
> de la sucursal filtrada) a no verlo del todo. `adspendView` vuelve a sumar siempre los 3 canales
> completos, con o sin sede filtrada; `av.omitido` se sigue calculando (por si se necesita mostrar
> el aviso de nuevo en el futuro) pero **ya no resta nada** — solo dispara el aviso informativo en
> el hint de la pestaña Presupuesto, no una omisión real. **No revertir a la versión que omite sin
> que Irvin lo pida explícitamente de nuevo** — ya se intentó y no era lo que quería.

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

**Proyección de fin de mes** (`monthProjection(recs, efectivosAgregados)`): usa **"día vencido"**
como corte — el último día ya completo (ayer), NO el día en curso. **Historia:** el 2026-07-01 Irvin
dijo que llena `FECHA DE AGENDA` día a día al finalizar el día, así que se usó "hoy cuenta completo"
(sin restar un día). El 2026-07-07 pidió explícitamente el cambio a día vencido — no quiere que el
día en curso (todavía incompleto) cuente como si ya hubiera cerrado. `monthCutoffInfo()` (§5d) hace
`cutoff = hoy - 1 día`; si hoy es el día 1 del mes, el corte cae en el último día del mes anterior
(caso límite ya contemplado, no es un bug). "Agendados" cuenta filas del mes en curso hasta el corte
(sigue siendo por fila, `enMesActual`); "Efectivos" desde 2026-08-01 usa `efectivosAgregados`
(el `k.efectivos` del scope actual, ver "Asistidos corregido" arriba) porque ya no hay forma de
filtrar asistencia por día — el agregado de `ASISTIDOS` no trae fecha, se trata como acumulado del
periodo (igual que `LEADS`); `null` para GERONTOLOGIA, que cae de vuelta a contar `asiste==='SI'`
por fila y mes como antes. Cada tasa saca el ritmo diario (`total/díasTranscurridos`) y proyecta a
fin de mes (`ritmo × díasDelMes`, usando `daysInMonth()` real del mes — 31 para julio, no
hardcodeado). Se muestra en la pestaña **Presupuesto**, debajo de las tarjetas de leads/CAC — desde
2026-08-01 solo se pintan las tarjetas de agendados/efectivos (las de "planes" se quitaron junto con
el resto del tema de cierre de planes, ver §4 — ese concepto ya ni se calcula, a diferencia del
cambio anterior donde `monthProjection` seguía calculando planes internamente sin mostrarlos).
**No volver a "hoy cuenta completo" sin que Irvin lo pida de nuevo explícitamente** — ya se cambió
una vez en su petición directa.

> Los leads/gasto de Facebook por sucursal usan los mismos códigos cortos que `TIERS`
> (normalizados con `normSede`, ver §6) — si el nombre de una sucursal nueva no tiene un prefijo ya
> contemplado (`CLINICA`, `EQUILIBRIO TOTAL`, `FSH`), no va a calzar y quedará fuera del desglose.

> **`asISO` también convierte fechas de texto** (`"01/07/2026"` en vez de una fecha real de Excel) —
> a veces la celda de `FECHA DE AGENDA` llega como texto plano en formato `DD/MM/AAAA[ HH:MM]` en
> lugar de una fecha de Excel; sin esto, `monthProjection`/`inMonth` fallaban silenciosamente (Invalid
> Date) para esas filas y las excluían de la proyección sin avisar. `asHora` (par de `asISO`, ver §5g)
> hace lo mismo para la hora.

> **`normSede` también limpia texto de directorio pegado por error**: alguna vez una celda de `SEDE`
> trae algo como `"Equilibrio total | Nicolás Romero | Fisioterapia & Rehabilitación"` (texto de un
> anuncio, no solo el nombre). `normSede` detecta el `|` y toma el primer segmento no vacío como
> nombre de sede (después de quitar los prefijos conocidos).

## 5d. Canal GERONTOLOGIA (agregado 2026-07-06)

Irvin agregó un servicio nuevo (gerontología) con su propia hoja de pacientes, estructuralmente
distinta a las demás:

- **`BASE DE GERONTOLOGIA`**: hoja de pacientes aparte (no entra en la hoja unificada `BASE DE
  PACIENTES`). Columnas: `NOMBRE`, `APELLIDO`, `NUMERO`, `FECHA DE AGENDA`, `SUCURSAL` (alias de
  `SEDE`, `col('SEDE','SUCURSAL')` ya lo cubre — desde 2026-08 trae sucursales reales, ya no cae
  siempre en `'SIN SEDE'`), **`SERVICIO`** (ej. `"Consulta Inicial Gerontologia"`,
  `"Clase baile gerontología"`) en vez de `PADECIMIENTO`, y **`ASISTE`** — es el único canal que
  sigue trayendo asistencia real por paciente (ver §4/§5c "Asistidos corregido", que no aplica aquí).
  Desde 2026-08 ya no trae `COSTO INICIAL`/`PLAN`/`MONTO`/`CXC` (igual que el resto, ver §4).
- **`GERONTOLOGIA`**: hoja de presupuesto agregado (`LEADS`/`PRESUPUESTO`), mismo patrón que
  `PROMOCIONES`/`GOOGLE`/`ORGANICO` — sin desglose por sucursal, así que no puede alimentar el
  Asistidos corregido de las demás (ver §5c); Gerontología no participa de esa corrección.

`parseWorkbook` (excel_to_dat.js y dashboard_template.html) busca `BASE DE.*GERONTOLOG` **siempre**,
sin importar si el archivo usa el formato unificado o el viejo por canal — es una hoja adicional,
independiente, con canal fijo `'GERONTOLOGIA'` para todas sus filas (no se detecta por texto).

> **Gerontología es el único canal con `ASISTE` real por paciente (desde 2026-08-01):** `kpis()`,
> `sedeAgg()` y `monthProjection()` ramifican explícitamente por esto — para `state.canal===
> 'GERONTOLOGIA'` cuentan `asiste==='SI'` por fila (como todo el dashboard hacía antes de este
> cambio); para el resto usan el Asistidos agregado corregido (ver §5c). En `sedeAgg`, la decisión es
> por grupo de sede: si `_canalRows.GERONTOLOGIA` está presente en ese grupo, usa conteo por fila —
> en la práctica nunca se mezcla con otro canal en la misma vista porque `recsForCanal` ya filtra a
> un canal a la vez (Consolidado excluye Gerontología, ver más abajo).

**Campo nuevo `servicio`** (string, `''` por default en los demás canales): se agrega a todo
registro vía `col('SERVICIO')` en `extractPatientRows`. A diferencia de `padecimiento` (texto libre
que necesita el clasificador `PAD_GROUPS`), `servicio` ya viene limpio del Excel, así que se agrupa
por **valor exacto** con `servicioAgg(base)` — sin clasificador. `renderServicio(base)` pinta el
panel **"Por servicio"** en la pestaña Resumen (reutiliza el CSS `.padrow`/`.ptrack`/`.pfill` de
Padecimientos); el panel se **oculta solo** (`display:none`) si la vista actual no tiene ningún
registro con `servicio` (o sea, para Facebook/Promociones/Google/Orgánico no aparece).

`GERONTOLOGIA` se agregó también a: `segCanal` (botón + `--c-geronto`), `detectMirrors`. El resto
(KPIs, embudo, Sucursales) lo toma solo porque son genéricos sobre
`state.canal`/`recsForCanal` — no necesitaron cambios.

> **Excluido de Consolidado a propósito (2026-07-07):** Irvin pidió que Gerontología "quede muy
> aparte" — es una línea de servicio distinta, no un canal de mercadotecnia, y no debe mezclarse con
> el embudo Leads→Agendados→Efectivos del resto. `recsForCanal('TODOS')` la excluye
> explícitamente (`r.canal!=='GERONTOLOGIA' && (...)`), y `adspendView('TODOS',...)` no la incluye en
> su lista de canales. Solo se ve seleccionando el botón "Gerontología" directamente — nunca aparece
> mezclada en Consolidado. Si se agrega otro canal "aparte" en el futuro, seguir este mismo patrón
> (excluirlo en ambos lugares) en vez de agregarlo a las listas de Consolidado.

## 5e. Plan diario (hoja "Proyecciones", pestaña "Plan diario", agregado 2026-07-06)

Irvin pega en el Excel un **PivotTable de Excel tal cual** (hoja `PROYECCIONES`) con las citas que
ya tiene agendadas por sucursal y día del mes, en 3 bloques por división (`CORPORATIVO`,
`FRANQUICIAS`, `FRANQUICIAS TERCERIZADAS` → se normaliza a `TERCERIZADAS`). Esto le sirve a Irvin
para ver qué día tiene que "apretar más" para no bajar el ritmo mensual.

**Formato del PivotTable (no es una tabla limpia, ojo al tocar el parser):**
```
fila 0: nombre de la división sola en columna A (ej. "CORPORATIVO")
fila 1: "Cuenta de Nombre" | "Etiquetas de columna"     <- boilerplate del pivot, se ignora
fila 2: "Etiquetas de fila" | día | día | ... | "Total general"  <- el día REAL de cada columna
filas N: sucursal | cantidad por día | ...
fila final: "Total general" | subtotal por día | ...
```
**Los días de la fila 2 NO son consecutivos** — si ningún registro cayó en un día para NINGUNA
sucursal del bloque, Excel quita esa columna del pivot entero (ver bloque TERCERIZADAS del archivo
real: salta del día 4 al 6 porque el día 5 no tuvo citas en ninguna de esas 5 sucursales). El parser
(`parseProyecciones` en excel_to_dat.js, `parseProyeccionesBrowser` en dashboard_template.html —
misma lógica exacta, mantener en sync) lee el día real de cada columna en vez de asumir 1..N.

Resultado guardado en `adspend.dat` como `PLAN_DIARIO`:
```
{ CORPORATIVO: { BALBUENA: {1:2, 2:3, ...}, CHALCO: {...}, ... }, FRANQUICIAS: {...}, TERCERIZADAS: {...} }
```

**Pestaña "Plan diario"** (`renderPlanDiario()`): por cada división, una fila por día (unión de
todos los días presentes en cualquier sucursal de esa división), mostrando planeado vs real:

- **"Real" se calcula siempre en vivo desde `RECORDS`** (agrupando por `fecha` del mes/año actual),
  **no** se confía en los totales del pivot de Irvin — su pivot es una foto de un momento dado y
  puede quedar desfasado si sigue capturando pacientes después de pegarlo (se verificó con datos
  reales: para Chalco día 2 el pivot decía 16, `RECORDS` decía 14 — la diferencia es real, no un
  bug del parser).
- **Días futuros** (`día > díasTranscurridos` de `monthCutoffInfo()`) no llevan semáforo ni
  comparación — solo se informa cuántas ya están agendadas para ese día (no tiene sentido decir que
  "van atrasados" en un día que no ha pasado).
- **Semáforo por día:** `real/planeado >= 1` verde, `>= 0.8` amarillo, si no rojo — mismo criterio
  que la meta mensual de sucursal (§8b), por consistencia.
- Esta pestaña **ignora el filtro global de canal/sede** a propósito — es una herramienta de
  planeación operativa (todas las sucursales, todos los canales), no una vista analítica filtrada.
  Si se necesita filtrar por sede en el futuro, avisar antes de asumir que ya se puede.

**Alertas de la semana** (`renderAlertasSemana()`, agregado 2026-08-01): pedido explícito de Irvin
— "no quiero que ya sea 20 de agosto y siga apareciendo la alerta del día 2 de agosto". Reempaqueta
los mismos datos de `buildPlanReal()` (factorizado de `renderPlanDiario` para reutilizarlo aquí) como
tarjetas estilo Focos rojos (`.foco`/`.focos-grid`), mostrando las sucursales más atrasadas vs. lo
planeado **solo de los días de la semana ISO actual (lunes-domingo) que ya pasaron**.
`weekCutoffInfo()` (mirror de `monthCutoffInfo()`) calcula esos días **siempre desde `new Date()` en
cada render** — nada se persiste ni se guarda en `state`, así que la próxima vez que se abra el
dashboard (otra semana, otro mes) el rango se recalcula solo y nunca queda una alerta vieja. Si la
semana cruza un cambio de mes, los días que caen en el mes anterior se recortan (no hay datos de
`PLAN_DIARIO` para ellos de todas formas, ya que ese objeto es por-día-del-mes-en-curso, ver arriba)
— caso borde poco frecuente, simplificado a propósito. Se pintan solo sucursales con `planeado>=3`
en la semana (evita ruido de sucursales con muy poco plan cargado) y `ratio<1` (van atrasadas),
ordenadas de más a menos atrasadas, top 5 — mismo criterio de "cuántas y por qué" que Focos rojos.

## 5f. Filtro de fecha (Hoy / Ayer / rango personalizado, agregado 2026-07-06)

Pedido de Irvin: poder ver "cuántos acudieron" en un día específico o rango, sin tener que mirar
toda la base. Filtra por `fecha` (fecha de la CITA, no `dia` de captura) — mismo campo que usa
`hasCita`/`agendCount` en todo el dashboard.

`state.dateFrom`/`state.dateTo` (strings ISO `YYYY-MM-DD` o `null`). Se aplica dentro de
**`selSedes(recs)`** (no en una función aparte) — a propósito, porque casi todos los `renderX(base)`
ya llaman `selSedes(base)` internamente (`renderFocos`, `renderSede`, `renderPatients`, `renderPad`,
`renderServicio`, y el `recs` de `render()`); meter el filtro ahí es el único choke-point que lo
aplica parejo en todo el dashboard sin tocar cada `renderX` por separado. Si se agrega un nuevo
bloque visual que necesite `base` filtrado, usar `selSedes(base)` y ya hereda el filtro de fecha
gratis — no filtrar por fecha a mano en otro lado.

Controles en la barra de filtros: botones **Hoy**/**Ayer** (ponen `dateFrom=dateTo=` esa fecha) +
2 `<input type="date">` para rango personalizado + botón **✕** para quitar el filtro. `btnReset`
("Limpiar filtros") también lo resetea. `renderPlanDiario()` es la única vista que **no** pasa por
`selSedes` (ver §5e) y por lo tanto ignora este filtro también, a propósito.

## 5g. Especialidad y horarios pico → pestaña "Horarios y Áreas" (agregado 2026-08-01, rework 2026-08-03)

Pedido original de Irvin junto con el resto del rework del Excel (ver §4): quería ver **especialidad**
(Acupuntura/Fisioterapia/Quiropráctica...) y **qué horarios por sucursal traen más iniciales**. Al
momento de ese cambio, `ESPECIALIDAD` estaba 100% vacía en el Excel real — todo lo de abajo degradaba a
"sin datos" (panel oculto). Desde entonces el Excel ya trae `ESPECIALIDAD`/`hora` reales, e Irvin pidió
de nuevo (2026-08-03) que esta parte del dashboard **"recalque mucho"** qué horarios traen más citas y
a qué área están llegando, porque si una área se satura mientras otra queda vacía en una sede quiere
poder verlo de inmediato y equilibrar la agenda. Esto reemplazó la pestaña **Ranking**, que se quitó
(ver §9/§11) — mismo espacio en la barra de pestañas, ahora ocupado por **Horarios y Áreas**.

- **`hora`** (string `'HH:MM'` o `null`): `asHora(v)` (excel_to_dat.js, junto a `asISO`; copia
  idéntica en dashboard_template.html) extrae la hora de la misma celda de `FECHA DE AGENDA` — de un
  `Date` de Excel via `getHours()/getMinutes()`, o de texto `"DD/MM/AAAA HH:MM"` via regex. Si la
  hora es exactamente medianoche (`00:00`) se trata como "no capturada" (`null`), no como una cita a
  medianoche real — es el patrón típico de una fecha de Excel sin componente de hora.
- **`especialidad`** (string, `''` si no capturada): `col('ESPECIALIDAD')` en `extractPatientRows`,
  valor libre del Excel (ej. `"Consulta Inicial Acupuntura"`, `"...Acupuntura Fundación"`). **Desde
  2026-08-03 se normaliza en pantalla** con `areaOf(especialidad)` (dashboard_template.html) a una de
  3 áreas exactas — `Acupuntura` / `Fisioterapia` / `Quiropráctica` — por coincidencia de substring
  (`ACUPUNTURA`, `FISIOTERAP`, `QUIROPR`), ignorando el sufijo `Fundación` y cualquier otro texto.
  Cualquier especialidad que no matchee ninguna de las 3 (o venga vacía) se descarta, no se inventa
  una categoría "otras". `AREA_LIST`/`AREA_COLOR` (dashboard_template.html) son la fuente única de las
  3 áreas y sus colores (teal/azul/morado) — se reutilizan en todo lo de abajo.

Todo lo de esta sección vive en la pestaña **Horarios y Áreas** (`data-panel="horarios"`, reemplazó a
Ranking), en este orden:

1. **Alertas de desequilibrio por área** (`areaAgg`/`areaImbalances`/`renderAreaAlerts`, contenedor
   `#focosArea`, mismo estilo visual que Focos rojos — `.focos`/`.foco`): por sede, suma citas por
   área; sedes con ≥6 citas con área capturada donde la más cargada tiene ≥4 citas y triplica o más a
   la más vacía (o esta última está en cero) salen como tarjeta accionable ("Quiropráctica casi
   vacía: 0 de 7 citas con área · mueve leads/disponibilidad hacia Quiropráctica"), ordenadas por qué
   tan disparejas están. Sin desequilibrios → mensaje verde "buen momento para mantenerlo así" (mismo
   patrón que Focos rojos/Alertas de la semana).
2. **Heatmap "Horario × Área"** (`horarioAreaAgg`/`renderHorarioArea`, panel `#horarioAreaPanel`):
   agrupa por hora redondeada (`"17:00"`, no `HH:MM` exacto — 31 franjas de 15 min sería ilegible) ×
   área, una fila por hora con una celda por área coloreada por intensidad (`hexA(color, n/maxCell)`,
   mínimo 16% de opacidad si `n>0`) — de un vistazo se ve qué franja+área concentra más citas en la
   vista actual. Oculto si ninguna fila trae `hora`+`especialidad` reconocida.
3. **Panel "Horarios pico por sucursal"** (`horariosAgg`/`renderHorarios`, panel `#horariosPanel`,
   movido aquí desde la pestaña Sucursales): agrupa por `sede` + `hora`, y por cada sucursal muestra
   sus 3 franjas horarias con más agendados (badges `HH:MM · n`, de mayor a menor). Oculto si ninguna
   fila de la vista trae `hora`.
4. **Panel "Por área"** (`especialidadAgg`/`renderEspecialidad`, panel `#especialidadPanel`, movido
   aquí desde la pestaña Padecimientos): barras por área (ya normalizada a las 3) con conteo de
   agendados, mismo patrón visual que "Por servicio" (`.padrow`/`.ptrack`/`.pfill`). Oculto si ninguna
   fila de la vista trae área reconocida.

Los 4 respetan el filtro de canal/sede activo igual que el resto del dashboard (`selSedes`) — si
Irvin filtra a una sola sede, las 4 vistas se recalculan solo para esa sede.

> **`padAgg` ya no puede calcular efectividad por padecimiento** (cambio 2026-08-01): antes usaba
> `asiste==='SI'` por fila, que dejó de existir para los 4 canales de marketing (ver §4) — ahora solo
> cuenta volumen de agendados (`n`) y agendados del mes en curso (`nMes`, mismo corte que
> `monthCutoffInfo`, para dar una señal de "qué está subiendo ahora" ya que no hay % de asistencia
> que mostrar). Las columnas "Efectivos"/"% Asist." y la tarjeta "Mejor % de asistencia" del panel de
> padecimientos se quitaron por lo mismo — no hay forma honesta de calcularlas sin inventar un
> reparto proporcional del Asistidos agregado, que nadie pidió.

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
> aplicar `SEDE_FIX`. Sin esto, ninguna sede calzaba con `TIERS` y la tabla de sucursales
> se veía vacía o todo caía en "sin grupo". Si aparece una sucursal nueva con un prefijo distinto,
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
- `kpis(recs, realLeads?, realAsistidos?)` → objeto con leads, agendados, efectivos, tasas. `realLeads`
  (de `adspendView`) reemplaza `recs.length` como leads cuando hay dato real; `realAsistidos` (de
  `realAsistidosView`, ver §5c) reemplaza el conteo por fila como efectivos — `null` para
  GERONTOLOGIA, que cae a contar `asiste==='SI'` por fila (ver §5d).
- `realAsistidosView(canal,sedeSet)` (§5c) / `sedeRealLeads(sede,canalRows)` (§5c, leads) /
  `sedeAsistidos(sede,canalRows)` (§5c, efectivos) → mirrors de `adspendView` para asistidos
  corregidos, red completa y por sucursal respectivamente.
- `sedeAgg(base)` → agrega por sede (+ divKey, salud-inputs); usa `sedeRealLeads` para `leads` y
  `sedeAsistidos` para `asis` (GERONTOLOGIA por fila, resto agregado corregido, ver §5c/§5d); usa
  `sedeMetaInfo` para meta/ritmo/déficit/proyección del mes (ver §8b)
- `divAgg(rows)` → subtotales por división (incluye meta/proyección agregadas)
- `salud(s)` → semáforo (score 0-100 + status + métrica más débil). Metas en `TARGETS`.
- `monthCutoffInfo()` / `enMesActual(r,ci)` → corte compartido del mes en curso (a día vencido),
  usado por `monthProjection`, la meta de sucursal y `padAgg` (nMes, ver §5g)
- `weekCutoffInfo()` (§5e) → mismo corte pero para la semana ISO actual, usado por `renderAlertasSemana`

**Render (una función por bloque visual)**
- `render()` → orquesta TODO. Se llama en cada cambio de filtro. Lee `selSedes(recsForCanal(canal))`.
- `renderFunnel(k)`, `renderKpis(k,base)`, `renderDonut(k)` (2 segmentos, ver §4)
- `renderSede(base)` + `renderSedeBars` + `sedeRowHtml` + `divRowHtml` (tabla agrupada por división con semáforo y TOTAL GENERAL)
- `renderPad(base)` + `padAgg` + `padGroupKey` (clasificador de padecimientos, 17 grupos + OTRO;
  solo volumen desde 2026-08-01, ver §5g)
- `renderPatients(base)` (tabla de pacientes, chips, búsqueda, color por división)
- `renderFocos(base)` (focos rojos: sedes ≥4 agendados, no verde, top 5 por urgencia)
- `renderPresupuesto(recs,k)` + `adspendView(canal,sedeSet)` + `monthProjection(recs,efectivosAgregados)`
  (leads reales/CAC/CPL + proyección de fin de mes, ver §5c)
- `renderLeadsPorDivision()` (leads reales de Facebook agrupados por división vía `tierOf`,
  panel fijo en Presupuesto — reutiliza `rankBarsHtml`, ver §5c)
- `rankBarsHtml(rows,valueKey,fmt)` (barras genéricas con badge de posición — hoy solo la usa
  `renderLeadsPorDivision`; la pestaña Ranking que la originó se quitó, ver §9/§11)
- `areaOf(esp)`, `AREA_LIST`, `AREA_COLOR`, `areaAgg(base)`, `areaImbalances(base)`,
  `renderAreaAlerts(base)`, `horarioAreaAgg(base)`, `renderHorarioArea(base)`,
  `renderHorarios(base)` + `horariosAgg`, `renderEspecialidad(base)` + `especialidadAgg` — toda la
  pestaña **Horarios y Áreas** (ver §5g)
- `buildPlanReal()` + `renderPlanDiario()` (planeado vs real por día y división, vía
  `ADSPEND.PLAN_DIARIO`; ver §5e) + `renderAlertasSemana()` (mismos datos, recortados a la semana en
  curso, ver §5e)

**Controles**
- `buildSedeControl` / `syncSedeUI` / `setSedeFilter` (multi-select de sedes + botones de tier)
- `setTab(t)` + handler de `#tabbar` (navegación por pestañas)
- `setDateRange(from,to)` / `syncDateUI()` / `isoToday(offsetDays)` (filtro Hoy/Ayer/rango, ver §5f)
- `state` = objeto global de estado: `{canal, sedes:Set, search, chip, padFilter, sedeSort, patSort, padSort, dateFrom, dateTo}`

**Efectos**
- Tilt 3D de tarjetas KPI: IIFE con listener `mousemove` sobre `#kgrid`.

## 8. Semáforo de salud (`salud` + `TARGETS`)

```
TARGETS = { sched: .30, asis: .65 }   // metas
score = 100 * ( 0.5*min(agendamiento/.30,1)
              + 0.5*min(asistencia/.65,1) )
status = score>=80 ? 'verde' : score>=55 ? 'amarillo' : 'rojo'
```

Se usa en: focos rojos y punto/pastilla de semáforo en la tabla de sucursales. **Cambio 2026-08-01:**
antes tenía una tercera pata de "cierre" (planes/efectivos) con pesos 35/30/35 — se quitó junto con
el resto del tema de cierre de planes (ver §4), quedó 50/50 entre agendamiento y asistencia. No se
reemplazó por "conversión" para no duplicar señal (conversión ya es función de agendamiento×asistencia).

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
lleva          = Asistidos corregido de la sucursal (sedeAgg → s.asis, ver §5c) — GERONTOLOGIA sigue
                 contando asiste==='SI' por fila (§5d), el resto usa el agregado ya corregido.
déficit        = lleva − esperadoHoy                  // negativo = va atrasado respecto al ritmo
ritmoActual    = lleva / díasTranscurridos
proyección     = round(ritmoActual × díasDelMes)
metaRatio      = lleva / esperadoHoy
semáforo       = metaRatio>=1 ? verde : metaRatio>=0.8 ? amarillo : rojo
```

> **Cambio 2026-08-01:** antes `lleva` filtraba "asistió Y pagó su consulta inicial"
> (`costo_pago>0`, regla de Irvin 2026-07-06) — ese pago ya no existe en el Excel (ver §4), así que
> la meta ahora cuenta el Asistidos corregido completo, sin filtro de pago.

**Por qué el déficit es contra "lo esperado a hoy" y no contra la meta total:** así se ve quién va
mal *ahora*, a mitad de mes, en vez de que todas las sucursales salgan "en déficit" simplemente
porque aún no termina el mes. El detalle completo (ritmo necesario + déficit) sale en el `title`
(tooltip) del punto de semáforo y del número, para no saturar la celda.

Usa el mismo corte compartido que `monthProjection` (§5c, `monthCutoffInfo()`) — **a día vencido**
(ayer, no el día en curso) desde el 2026-07-07. La fila TOTAL GENERAL y las filas de subtotal por
división suman `meta`/`lleva` de sus sucursales y recalculan ritmo/proyección/semáforo sobre esa
suma (no promedian los semáforos individuales).

## 9. Pestañas (7) — cada una es un `<section class="tabpanel" data-panel="X">`

**Orden 2026-08-01** (Resumen → Sucursales → Padecimientos primero, a pedido de Irvin — quería citas/
padecimientos/metas como protagonistas en vez del orden original que abría con Ranking/Presupuesto).
**La pestaña Ranking se quitó 2026-08-03** (petición reiterada de Irvin: "no me sirve de mucho") y se
reemplazó, en el mismo lugar de la barra, por **Horarios y Áreas**:

1. **resumen** — focos rojos + embudo de 3 etapas (Leads→Agendados→Efectivos) con insignia de
   Conversión + KPIs (con tilt 3D, sin dinero, ver §4) + gráficas (barras + dona de 2 segmentos
   Efectivos/Resto, ver §4) + panel "Por servicio" (condicional, ver §5d)
2. **sucursales** — tabla agrupada por división, subtotales, TOTAL GENERAL, semáforo, meta del mes (§8b)
3. **padecimientos** — clasificador + tarjetas + barras + tabla (solo volumen de agendados, ver §5g);
   clic filtra la base y salta a Pacientes
4. **horarios** ("Horarios y Áreas") — alertas de desequilibrio por área + heatmap horario × área +
   panel "Horarios pico por sucursal" + panel "Por área" (los 4 condicionales, ver §5g). Reemplazó a
   Ranking (ver §11).
5. **pacientes** — base completa (con Hora y Especialidad, ver §5g), chips (no asistió/pendiente —
   solo tienen dato real para Gerontología, ver §5d), búsqueda, color por división
6. **presupuesto** — leads reales/gasto/CPL/CAC (via `adspend.dat`, ver §5c) + proyección de fin de mes
7. **plandiario** — alertas de la semana en curso (ver §5e) + planeado vs real por día, por división
   (hoja "Proyecciones", ver §5e)

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
  (5 comparativas por sucursal coloreadas por división), que a su vez se quitó (petición reiterada de
  Irvin, 2026-08-03: "no me sirve de mucho") y se reemplazó por **Horarios y Áreas** (ver §7/§9/§5g).
  Si se vuelve a pedir un mapa, revisar el historial de `dashboard_template.html` para recuperar
  `SEDE_COORDS`, `ensureMap`, `buildMapData`, `sedeLayer`, `mapTooltip`, `updateMap`, el CSS
  `.mappanel`/`.mapwrap`/etc., y los `<script>`/`<link>` de MapLibre + deck.gl en el `<head>`. Si se
  vuelve a pedir el ranking, revisar el historial para recuperar el `<section data-panel="ranking">`
  y `renderRanking` (`rankBarsHtml` sigue vivo, ver §7).
- **CAC ya se calcula** (implementado 2026-07-01, ver §5c y pestaña Presupuesto): usa `adspend.dat`
  (gasto real por canal, Facebook con desglose por sucursal) + citas efectivas de la base de
  pacientes. Las hojas `PROMOCIONES`/`GOOGLE`/`ORGANICO` hoy no traen datos capturados (0), así que
  su CAC/leads reales saldrán en 0/— hasta que se llenen.
- **Proyección de fin de mes**: asume que el ritmo de captura ha sido parejo en lo que va del
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

## 14. Compartir con el equipo (historial de decisiones — vigente: GitHub Pages CON selector, 2026-08-04)

**Estado actual:** el dashboard se comparte de 2 formas en paralelo:

1. **Manual:** `Centro_de_Mando_Comercial.html` (WhatsApp, correo, o la carpeta de OneDrive del
   proyecto) — sin hosting, sin costo, es el archivo que se abre con doble clic.
2. **Link público (GitHub Pages):** `https://irvinfrancis1004.github.io/centro-de-mando-comercial/`
   — repo `centro-de-mando-comercial` en la cuenta de Irvin, Pages sirviendo desde `/docs`.
   `node build_pages.js` (o `node publish.js`, que además hace `git commit`+`push`) genera
   `docs/index.html` (selector) + `docs/<mes>.html` **por cada mes** que ya tenga
   `data/<MES>/pacientes.dat` — mismo selector que el archivo local, mismos datos reales de
   paciente (nombre, teléfono, padecimiento), para **todos** los meses (cerrados incluidos), no
   solo el vigente.

**Por qué el link incluye datos reales de paciente, a propósito:** es la única forma gratis de
lograr "Irvin actualiza el Excel, corre un comando, se refleja para todo el que tenga el link, sin
que reboten con Subir Excel". Decisión explícita de Irvin (2026-07-04) para el mes vigente,
**extendida a todos los meses el 2026-08-04** (pidió el selector completo en el link público,
confirmando que entendía que eso hace público también a Julio). Mientras el repo exista, cualquiera
con el link ve nombre/teléfono/padecimiento reales de todos los meses publicados — no hay control
de acceso.

> **Historial (2026-07-03 → 2026-08-04), por si se vuelve a cuestionar la decisión:** se evaluó
> primero descartar GitHub Pages por completo (riesgo legal de publicar datos de salud bajo la
> LFPDPPP, y porque GitHub Pro no restringe Pages a colaboradores — eso solo existe en GitHub
> Enterprise Cloud). El repo y el sitio llegaron a borrarse por esto. Después se reabrió de todos
> modos (commits "Actualizar dashboard publicado" desde 2026-07-14) publicando solo el mes vigente,
> para acotar la exposición. El 2026-08-04 Irvin pidió expresamente el selector completo en el link
> público — se le avisó explícitamente que eso incluye a Julio con datos reales antes de construirlo
> (ver conversación), y confirmó que lo quería así. Si se vuelve a acotar la exposición, la opción
> gratis que sí restringe acceso (a diferencia de GitHub Pages) es **Cloudflare Pages + Cloudflare
> Access** (gratis hasta 50 usuarios) — nunca se llegó a configurar.

## 15. Multi-mes: selector, meses congelados (agregado 2026-08-01)

Pedido explícito de Irvin: "quiero que Julio ya no se mueva en nada" (los datos de julio quedan
congelados tal cual, no se vuelven a tocar) + un Excel nuevo para Agosto + una pantalla de
selección de mes **antes** de entrar al dashboard.

**Idea central:** cada mes es independiente — su propio Excel, su propia carpeta de datos, su
propio HTML final. `Centro_de_Mando_Comercial.html` (el archivo de siempre, el que se comparte)
dejó de ser el dashboard — ahora es el **selector**, y cada mes vive en
`Centro_de_Mando_Comercial_<MES>.html` (`_JULIO.html`, `_AGOSTO.html`, ...). Decisión de Irvin
(2026-08-01): el selector es **solo para uso local** — el link público de GitHub Pages
(`docs/index.html`, ver §14) sigue mostrando un solo mes (el activo), sin selector.

**`months.json`** (raíz, autogenerado por `excel_to_dat.js`, NO se sube a GitHub — tiene rutas
locales, ver `.gitignore`) es el registro de meses. Un mes:

```json
{ "key": "AGOSTO", "label": "Agosto", "year": 2026,
  "source": "C:\\...\\COMERCIAL AGOSTO.xlsx",
  "frozen": false, "frozenAt": null, "updatedAt": "2026-08-01T22:50:10.549Z" }
```

- `key` es el identificador (MAYÚSCULAS) — nombra la carpeta `data/<key>/` y el archivo
  `Centro_de_Mando_Comercial_<key>.html`.
- `frozen:true` = mes cerrado. `excel_to_dat.js <MES>` se **niega** a correr sobre un mes congelado
  (`ERROR: <MES> está congelado...`) salvo que se pase `--force` — así se garantiza que un mes
  cerrado no cambie por accidente (ej. correr `npm run update` sin fijarse qué mes está activo).
  `build.js <MES>` **sí** se puede correr sobre un mes congelado (reconstruye el HTML desde el
  `.dat` ya congelado — útil si cambia el estilo de la plantilla y quieres que Julio se vea
  consistente; no cambia ni un dato).
- `source` se recuerda por mes (reemplaza al viejo `.last_source` global, que ya no existe) — así
  `node excel_to_dat.js AGOSTO` sin ruta reutiliza el último Excel de Agosto.
- **Mes activo** = el único mes con `frozen:false`. Si hay exactamente uno, todos los comandos
  (`excel_to_dat.js`, `build.js`, `build_pages.js`) lo adivinan solo cuando no se especifica mes —
  así `npm run update` sigue funcionando sin cambios de hábito una vez que solo Agosto está abierto.
  Si hay 0 o 2+ meses abiertos, los scripts piden que se especifique el mes explícitamente (evita
  adivinar mal cuál mes se quería actualizar).

**`months.js`** centraliza esta lógica (load/save de `months.json`, `activeMonth()`, `dataDir(key)`,
`htmlPath(key)`, `labelFor(key,year)`) — lo usan `excel_to_dat.js`, `build.js`, `build_pages.js` y
`build_selector.js`, para no duplicar la resolución de mes en cada script.

**Pipeline por mes:**

```bash
node excel_to_dat.js AGOSTO "ruta\excel.xlsx"   # -> data/AGOSTO/pacientes.dat + adspend.dat
node build.js AGOSTO                             # -> Centro_de_Mando_Comercial_AGOSTO.html (+ refresca el selector)
```

`build.js` sin mes construye **todos** los meses presentes en `months.json` de un jalón (incluido
Julio, desde su `.dat` ya congelado) y siempre termina llamando a `build_selector.js` — así el
selector nunca queda desfasado de qué meses existen.

**`build_selector.js`** genera `Centro_de_Mando_Comercial.html`: una tarjeta por cada mes que ya
tenga su HTML construido (ordenados con el mes vigente primero, luego los cerrados del más
reciente al más viejo), con un link relativo normal a `Centro_de_Mando_Comercial_<MES>.html` — no
usa servidor, funciona igual con doble clic (`file://`) que los demás. Reutiliza la paleta/tipos
del dashboard para que se sienta parte del mismo producto, pero es una página aparte, más simple
(sin JS de estado, solo HTML/CSS estático).

**Insignia de mes en cada dashboard:** `dashboard_template.html` ganó los placeholders
`__MES_LABEL__` (ej. "Agosto 2026"), `__MES_STATUS__` (`vigente`/`cerrado`), `__MES_BADGE_CLASS__`
(mismo valor, para el CSS) y `__MES_BADGE_HREF__`. Se pintan como una píldora clickeable en la
barra superior (`.mes-badge`, junto al reloj) — verde/punteada si es el mes vigente, apagada si
está cerrado — que lleva de vuelta al selector. `__FUENTE_LABEL__` reemplaza también el nombre del
Excel fijo que antes decía "COMERCIAL_JULIO.xlsx" en el reloj (`#clk-src`), ahora es el `source` de
`months.json` para ese mes. `build.js` apunta `__MES_BADGE_HREF__` a `Centro_de_Mando_Comercial.html`
(el selector, vive al lado); `build_pages.js` lo apunta a `#` (el selector no se publica en
GitHub Pages, ver arriba — un link roto ahí sería peor que no tener el botón).

**Julio, congelado (2026-08-01):** se copiaron tal cual los `pacientes.dat`/`adspend.dat` que ya
existían (root) a `data/JULIO/` — **no se regeneraron desde el Excel**, a propósito, para no
arriesgar que una relectura del Excel (aunque sea el mismo archivo) produzca un número distinto por
cualquier motivo. `months.json` marca `JULIO` con `frozen:true`. El Excel original semilla
(`COMERCIAL_JULIO.xlsx`, en la raíz, 2026-07-01) ya no es la fuente real que se usó para congelar
Julio — Irvin había apuntado `excel_to_dat.js` a otra copia del Excel en su OneDrive en algún
momento de julio (`.last_source` así lo tenía guardado); `months.json` conserva esa ruta real en
`source` para JULIO. El archivo `COMERCIAL_JULIO.xlsx` de la raíz queda como reliquia, no se borró
por si acaso, pero no lo uses como fuente de verdad de qué hay en `data/JULIO/`.

**Al agregar un mes nuevo** (ej. Septiembre): `node excel_to_dat.js SEPTIEMBRE "ruta.xlsx"` crea la
entrada en `months.json` solo (no hace falta editarlo a mano), `node build.js` construye su HTML y
lo agrega al selector automáticamente. Para cerrar un mes (dejar de alimentarlo), edita
`months.json` a mano y pon `"frozen": true` (y `"frozenAt"` con la fecha) en su entrada — no hay
todavía un comando dedicado para esto, es deliberadamente manual (una sola línea, poco frecuente,
no vale la pena un flag nuevo en el CLI todavía).

---

_Generado como handoff para continuar en Antigravity. Origen de datos: `COMERCIAL_JULIO.xlsx` (Julio,
congelado) y el Excel vigente de cada mes en `months.json` (ver §15)._
