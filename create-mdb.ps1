param(
  [Parameter(Mandatory=$true)]
  [string]$Path
)

$directory = Split-Path -Parent $Path
New-Item -ItemType Directory -Force -Path $directory | Out-Null
if (Test-Path $Path) { exit 0 }

$catalog = New-Object -ComObject ADOX.Catalog
$providers = @(
  'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=' + $Path + ';Jet OLEDB:Engine Type=5;',
  'Provider=Microsoft.Jet.OLEDB.4.0;Data Source=' + $Path + ';Jet OLEDB:Engine Type=5;'
)
$created = $false
foreach ($connectionString in $providers) {
  try {
    $catalog.Create($connectionString)
    $created = $true
    break
  } catch {
    if (Test-Path $Path) { Remove-Item -Force $Path }
  }
}
if (-not $created) {
  throw 'تعذر إنشاء ملف MDB. ثبّت Microsoft Access Database Engine أو Microsoft Access على Windows.'
}
