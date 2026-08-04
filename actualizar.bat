@echo off
cd /d "%~dp0"
echo ============================================
echo   Actualizando el dashboard con tu Excel...
echo ============================================
echo.
call npm run update
echo.
if errorlevel 1 (
  echo Algo fallo. Revisa el mensaje de arriba.
) else (
  echo Listo. Ya puedes abrir Centro_de_Mando_Comercial.html para verlo.
)
echo.
pause
