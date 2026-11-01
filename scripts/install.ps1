param(
  [string]$Package = 'https://github.com/kiryuken/mcp-mercy/archive/refs/heads/main.tar.gz',
  [string]$Prefix = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'mcp-mercy')
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Package) -or $Package.StartsWith('-')) {
  throw 'Package wajib diisi dan tidak boleh diawali tanda minus.'
}
if (-not [IO.Path]::IsPathRooted($Prefix)) {
  throw 'Prefix harus berupa path absolut.'
}
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCommand) {
  throw 'Pasang Node.js 22.22+ (disarankan 24) dari https://nodejs.org/.'
}
$NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $NpmCommand) { $NpmCommand = Get-Command npm -ErrorAction Stop }
$NodeVersionText = & $NodeCommand.Source --version
if ($LASTEXITCODE -ne 0 -or [version]($NodeVersionText.Trim().TrimStart('v')) -lt [version]'22.22.0') {
  throw 'Node.js 22.22+ diperlukan.'
}
& $NpmCommand.Source install --global --prefix $Prefix $Package
if ($LASTEXITCODE -ne 0) { throw 'Instalasi npm gagal.' }
Write-Output "mcp-mercy terpasang di $Prefix."
Write-Output "Tambahkan $Prefix ke PATH pengguna, lalu buka ulang terminal dan harness."
Write-Output 'Lanjutkan: mercy --help, mercy config opencode|claude|codex, dan mercy login.'
