param(
  [string]$Url = "https://facundocapello-blip.github.io/black-mamba/"
)

$ErrorActionPreference = "Stop"
$fallas = New-Object System.Collections.Generic.List[string]

Write-Host "== Black Mamba: $Url ==" -ForegroundColor Cyan

$tmp = Join-Path $env:TEMP ("bm_" + [guid]::NewGuid().ToString("N") + ".html")
try {
  $head = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 30
  Invoke-WebRequest -Uri $Url -OutFile $tmp -UseBasicParsing -TimeoutSec 30 | Out-Null
  $bytes = (Get-Item $tmp).Length
  Write-Host "respuesta: $($head.StatusCode) - $([math]::Round($bytes/1024)) KB" -ForegroundColor Green

  $html = [System.IO.File]::ReadAllText($tmp)

  # Es una app de un solo archivo: si pesa poco o no tiene el titulo, es una pagina de error.
  if ($bytes -lt 100000) { $fallas.Add("pesa $bytes bytes: parece una pagina de error, no la app") }
  if ($html -notmatch 'BLACK MAMBA') { $fallas.Add("no aparece el titulo BLACK MAMBA") }
  if ($html -notmatch 'Tesseract') { $fallas.Add("no aparece Tesseract: puede faltar el lector de cartas") }
  # Distingue esta version estable de un deploy viejo.
  if ($html -notmatch 'V1\.7M') { $fallas.Add("no aparece la etiqueta V1.7M: puede ser un deploy viejo") }
  if ($html -notmatch 'id="bmmPcToggle"') { $fallas.Add("no aparece el boton de modo PC (bmmPcToggle)") }
} catch {
  $fallas.Add("$Url -> $($_.Exception.Message)")
} finally {
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
}

Write-Host ""
if ($fallas.Count -eq 0) {
  Write-Host "SMOKE OK" -ForegroundColor Green
  exit 0
}
Write-Host "SMOKE FALLA ($($fallas.Count))" -ForegroundColor Red
$fallas | ForEach-Object { Write-Host " - $_" -ForegroundColor Yellow }
exit 1
