#!/usr/bin/env python3
"""
build.py — Regenera el dashboard inyectando los datos en la plantilla.

Uso:
    python3 build.py

Toma `dashboard_template.html` (que contiene el placeholder `const RAW_RECORDS = __DATA__;`)
y le inyecta el contenido de `pacientes.dat` (o `pacientes.json` si no existe `.dat`),
produciendo el archivo final `Centro_de_Mando_Comercial.html` (auto-contenido, se abre
directo en el navegador).

`pacientes.dat` se genera desde el Excel con `node excel_to_dat.js` (ver AGENTS.md §3).
Si tu máquina no tiene Python, usa el equivalente `node build.js` en su lugar.

Estructura esperada (plana, todo en la misma carpeta):
    build.py
    dashboard_template.html
    pacientes.dat / pacientes.json     (o data/pacientes.dat / data/pacientes.json)
    -> genera: Centro_de_Mando_Comercial.html
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).parent
tpl_path = ROOT / "dashboard_template.html"
data_path = next((p for p in (
    ROOT / "pacientes.dat",
    ROOT / "pacientes.json",
    ROOT / "data" / "pacientes.dat",
    ROOT / "data" / "pacientes.json",
) if p.exists()), None)
adspend_path = ROOT / "adspend.dat"

if not tpl_path.exists():
    sys.exit("ERROR: falta dashboard_template.html en esta carpeta.")
if data_path is None:
    sys.exit("ERROR: falta pacientes.dat / pacientes.json (busqué en ./ y ./data/). Corre antes: node excel_to_dat.js")

tpl = tpl_path.read_text(encoding="utf-8")
data = data_path.read_text(encoding="utf-8").strip()
adspend = adspend_path.read_text(encoding="utf-8").strip() if adspend_path.exists() else "{}"

n = tpl.count("__DATA__")
if n != 1:
    sys.exit(f"ERROR: se esperaba exactamente 1 placeholder __DATA__ en la plantilla, encontré {n}.")
na = tpl.count("__ADSPEND__")
if na != 1:
    sys.exit(f"ERROR: se esperaba exactamente 1 placeholder __ADSPEND__ en la plantilla, encontré {na}.")

out = tpl.replace("__DATA__", data).replace("__ADSPEND__", adspend)
assert "__DATA__" not in out and "__ADSPEND__" not in out, "Quedó un placeholder sin reemplazar."

out_path = ROOT / "Centro_de_Mando_Comercial.html"
out_path.write_text(out, encoding="utf-8")
print(f"OK  ·  {len(out):,} bytes  ->  {out_path.name}")
print("Ábrelo directo en el navegador (doble clic). No necesita servidor.")
