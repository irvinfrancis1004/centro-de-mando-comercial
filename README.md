# Centro de Mando Comercial · Equilibrio Total

Dashboard comercial de una sola página (HTML auto-contenido) para la red de 22 clínicas.
Embudo Leads → Agendados → Efectivos, por canal, división y sucursal, con horarios y áreas
(Acupuntura/Fisioterapia/Quiropráctica), semáforo, focos rojos y presupuesto/CAC por canal.
**Multi-mes:** cada mes tiene su propio dashboard y sus propios datos; los meses cerrados
quedan congelados tal cual.

## Abrir

Doble clic en **`Centro_de_Mando_Comercial.html`** — es la pantalla para elegir el mes (Julio,
Agosto, ...). Ahí eliges y entras al dashboard de ese mes. No necesita servidor.
(Solo el botón *Subir Excel*, dentro de cada dashboard, necesita internet.)

Para compartirlo con el equipo también existe un link web público (GitHub Pages) con el mismo
selector de mes — `node build_pages.js` (o `node publish.js`, que además hace commit+push) genera
`docs/index.html` + `docs/<mes>.html` con datos reales de paciente. Es decisión explícita de Irvin
publicar esos datos ahí (nombre/teléfono/padecimiento, de todos los meses, no solo el vigente);
ver AGENTS.md §14 para el historial completo de la decisión.

## Actualizar los datos del mes vigente

**Opción A — dentro del navegador (sin tocar nada más):** dentro del dashboard del mes, botón
**Subir Excel** → elige tu archivo de *base de pacientes*. Todo se recalcula solo, pero solo dura
la sesión (no se guarda).

**Opción B — dejarlo guardado (recomendado):**

```bash
npm run update       # usa el mes activo (el único no congelado) automáticamente
```

Para apuntar a otro Excel o trabajar un mes específico:

```bash
node excel_to_dat.js AGOSTO "ruta\a\tu\excel.xlsx"
node build.js AGOSTO
```

## Cerrar un mes (que ya no se mueva)

Edita `months.json` a mano y pon `"frozen": true` en la entrada de ese mes (con `"frozenAt"` con
la fecha). A partir de ahí, `excel_to_dat.js` se niega a regenerarlo (a menos que se pase
`--force`) — así queda protegido de cambios accidentales. Ver AGENTS.md §15 para el detalle
completo del sistema multi-mes.

## Editar / reconstruir (solo estilo o lógica, sin cambiar datos)

Se edita la plantilla, se reconstruye:

```bash
node build.js       # reconstruye TODOS los meses + el selector
```

Esto inyecta `data/<MES>/pacientes.dat` en `dashboard_template.html` por cada mes y genera
`Centro_de_Mando_Comercial_<MES>.html`, además de regenerar el selector
`Centro_de_Mando_Comercial.html`. **No edites los HTML finales a mano** (se sobrescriben).

## Archivos

| Archivo | Qué es |
|---|---|
| `dashboard_template.html` | Fuente que se edita (placeholders `__DATA__`, `__MES_LABEL__`, etc.) |
| `months.json` | Registro de meses (Excel fuente, congelado o no) — autogenerado, no se sube |
| `excel_to_dat.js` | Convierte el Excel en `data/<MES>/pacientes.dat` (Node) |
| `build.js` | Genera `Centro_de_Mando_Comercial_<MES>.html` por mes + el selector |
| `build_selector.js` | Genera `Centro_de_Mando_Comercial.html` (pantalla de selección de mes) |
| `data/<MES>/pacientes.dat` | Datos de ese mes (autogenerado, no editar a mano) |
| `Centro_de_Mando_Comercial.html` | Salida — el selector, lo que se abre con doble clic |
| `Centro_de_Mando_Comercial_<MES>.html` | Salida — el dashboard de ese mes |
| `AGENTS.md` | Contexto técnico completo para el agente de IA / equipo (ver §15 para multi-mes) |

Para el detalle técnico (arquitectura, funciones, modelo de datos, roadmap), ver **`AGENTS.md`**.
