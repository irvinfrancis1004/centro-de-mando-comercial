# Centro de Mando Comercial · Equilibrio Total

Dashboard comercial de una sola página (HTML auto-contenido) para la red de 22 clínicas.
Embudo Leads → Agendados → Efectivos → Planes, por canal, división y sucursal, con ranking
por sucursal, semáforo, focos rojos y presupuesto/CAC por canal.

## Abrir

Doble clic en **`Centro_de_Mando_Comercial.html`**. No necesita servidor.
(Solo el botón *Subir Excel* necesita internet.)

Para compartirlo con el equipo, se manda el archivo directo (WhatsApp, correo o la carpeta de
OneDrive del proyecto) cada vez que se actualiza — no hay link web público (se evaluó y se
descartó por el riesgo de exponer datos de pacientes; ver AGENTS.md §14 para el detalle).

## Actualizar los datos del mes

**Opción A — dentro del navegador (sin tocar nada más):** botón **Subir Excel** → elige tu
archivo de *base de pacientes* (hojas "BASE DE PACIENTES … FACEBOOK / PROMOCIONES / GOOGLE").
Todo se recalcula solo, pero solo dura la sesión (no se guarda).

**Opción B — dejarlo guardado en el dashboard que se abre con doble clic:**

```bash
npm run update       # Excel -> pacientes.dat -> Centro_de_Mando_Comercial.html
```

Por default usa `COMERCIAL_JULIO.xlsx` (o el último Excel que hayas usado). Para apuntar a otro archivo:

```bash
node excel_to_dat.js "ruta\a\tu\excel.xlsx"
node build.js
```

(Si tu máquina tiene Python en vez de Node, `python3 build.py` hace el mismo último paso.)

## Editar / reconstruir (solo estilo o lógica, sin cambiar datos)

Se edita la plantilla, se reconstruye:

```bash
node build.js       # o: python3 build.py
```

Esto inyecta `pacientes.dat` (o `pacientes.json` si no existe `.dat`) en `dashboard_template.html`
y genera `Centro_de_Mando_Comercial.html`. **No edites el HTML final a mano** (se sobrescribe).

## Archivos

| Archivo | Qué es |
|---|---|
| `dashboard_template.html` | Fuente que se edita (tiene el placeholder `__DATA__`) |
| `excel_to_dat.js` | Convierte el Excel en `pacientes.dat` (Node, necesita `npm install` una vez) |
| `pacientes.dat` | Datos vigentes generados desde el Excel (autogenerado, no editar a mano) |
| `pacientes.json` | Snapshot histórico de datos (204 registros × 3 canales) |
| `build.py` / `build.js` | Generan el HTML final (Python o Node, mismo resultado) |
| `Centro_de_Mando_Comercial.html` | Salida — lo que se abre |
| `COMERCIAL_JULIO.xlsx` | Excel original de origen |
| `AGENTS.md` | Contexto técnico completo para el agente de IA / equipo |

Para el detalle técnico (arquitectura, funciones, modelo de datos, roadmap), ver **`AGENTS.md`**.
