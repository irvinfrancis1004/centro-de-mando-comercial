# Centro de Mando Comercial · Equilibrio Total

Dashboard comercial de una sola página (HTML auto-contenido) para la red de 22 clínicas.
Embudo Leads → Agendados → Efectivos → Planes, por canal, división y sucursal, con mapa 3D,
semáforo, focos rojos y presupuesto/CAC por canal.

## Abrir

Doble clic en **`Centro_de_Mando_Comercial.html`**. No necesita servidor.
(La pestaña *Mapa 3D* y el botón *Subir Excel* sí necesitan internet.)

**O usa el link público (sin instalar nada):** https://irvinfrancis1004.github.io/centro-de-mando-comercial/
Abre sin datos — usa el botón **Subir Excel** para cargar tu archivo del mes. Todo se procesa en
tu navegador, nunca sube a ningún servidor.

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
