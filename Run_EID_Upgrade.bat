@echo off
echo ==============================================
echo Emirates ID Toolkit Upgrade & Config Tool
echo ==============================================
echo.

echo Ensuring python websocket-client library is installed for Administrator...
python -m pip install websocket-client

echo.
echo Stopping existing EID Toolkit Service...
net stop "Emirates ID Card Toolkit Service" 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Stop-Process -Name EIDAToolkitService -Force -ErrorAction SilentlyContinue"

echo.
echo Copying new 2026 configuration files to v3.1.6 folder...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item -Path 'D:\JTS Group\EID SDK\Extracted\IDCARDOFFLINE_ag_config_2026-04-14\*' -Destination 'C:\Program Files (x86)\ICAToolkitService\' -Force -ErrorAction SilentlyContinue"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item -Path 'D:\JTS Group\EID SDK\Extracted\IDCARDOFFLINE_ag_config_2026-04-14\config_lv_qa' -Destination 'C:\Program Files (x86)\ICAToolkitService\config_lv_prod' -Force"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item -Path 'D:\JTS Group\EID SDK\Extracted\IDCARDOFFLINE_ag_config_2026-04-14\config_tk_qa' -Destination 'C:\Program Files (x86)\ICAToolkitService\config_tk_prod' -Force"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item -Path 'D:\JTS Group\EID SDK\Extracted\IDCARDOFFLINE_ag_config_2026-04-14\config_vg_qa' -Destination 'C:\Program Files (x86)\ICAToolkitService\config_vg_prod' -Force"

echo.
echo Starting "Emirates ID Card Toolkit Service" (Official Windows Service)...
net start "Emirates ID Card Toolkit Service"

echo.
echo Restarting EID Python bridge on port 8989...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process -Name python -ErrorAction SilentlyContinue | ForEach-Object { if ($_.Id -ne $PID) { try { Stop-Process -Id $_.Id -Force } catch {} } }"

# Launch EID Python bridge in a visible console window
start "Emirates ID Python Bridge" python -u "C:\Users\sales\.gemini\antigravity\brain\e317013a-2fcd-45e8-9ccc-47477c1ee10f\scratch\eid_bridge.py"

echo.
echo ==============================================
echo Upgrade and configuration completed successfully!
echo ==============================================
echo.
pause
