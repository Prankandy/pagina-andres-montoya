# ============================================================
#  Registra el lector del radar en el Programador de tareas de
#  Windows: cada 5 minutos y al iniciar sesión, sin abrir ventanas
#  (conhost --headless). No requiere administrador.
#
#  Instalar:   powershell -ExecutionPolicy Bypass -File tools\instalar-radar.ps1
#  Ver estado: Get-ScheduledTaskInfo -TaskName "Radar de leads"
#  Quitar:     Unregister-ScheduledTask -TaskName "Radar de leads" -Confirm:$false
# ============================================================
$ErrorActionPreference = "Stop"

$nombre = "Radar de leads"
$node   = (Get-Command node).Source
$script = Join-Path $PSScriptRoot "radar-local.mjs"

if (-not (Test-Path (Join-Path $PSScriptRoot ".env.radar"))) {
  throw "Falta tools\.env.radar con la línea CRON_SECRET=... (la misma clave que en Vercel)."
}

$accion = New-ScheduledTaskAction -Execute "conhost.exe" `
  -Argument "--headless `"$node`" `"$script`"" -WorkingDirectory $PSScriptRoot

$cada5Minutos = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 5)
$alIniciarSesion = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"

# StartWhenAvailable: si el PC estaba dormido, corre apenas despierta.
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 3)

Register-ScheduledTask -TaskName $nombre -Action $accion `
  -Trigger @($cada5Minutos, $alIniciarSesion) -Settings $ajustes `
  -Description "Lee Reddit desde este PC y lo envía al radar de andresfmontoya.vercel.app" `
  -Force | Out-Null

Write-Host "Listo: '$nombre' corre cada 5 minutos. Registro: $PSScriptRoot\radar-local.log"
