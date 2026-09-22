# Empacota deploy/ em deploy.zip para subir no Gerenciador de Arquivos da Hostinger.
#
# Compress-Archive nao serve aqui: no Windows PowerShell ele grava os caminhos
# com "\", e o descompactador do servidor (Linux) cria arquivos chamados
# "treino\index.html" em vez das pastas. Por isso montamos o zip entrada por
# entrada, trocando a barra. O -Force do Get-ChildItem e o que inclui o
# .htaccess, que e um arquivo oculto.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$raiz = Split-Path -Parent $PSScriptRoot
$origem = Join-Path $raiz 'deploy'
$destino = Join-Path $raiz 'deploy.zip'

if (-not (Test-Path $origem)) { throw "Rode 'npm run deploy' antes: a pasta deploy/ nao existe." }
if (Test-Path $destino) { Remove-Item $destino }

$zip = [IO.Compression.ZipFile]::Open($destino, 'Create')
try {
  # Entradas de diretorio explicitas: ha descompactador que nao cria a pasta
  # sozinho quando ela so aparece implicita no caminho dos arquivos, e ai o
  # conteudo dela some no servidor sem dar erro nenhum.
  Get-ChildItem -Path $origem -Recurse -Directory -Force | ForEach-Object {
    $relativo = $_.FullName.Substring($origem.Length + 1).Replace('\', '/') + '/'
    $zip.CreateEntry($relativo) | Out-Null
  }
  Get-ChildItem -Path $origem -Recurse -File -Force | ForEach-Object {
    $relativo = $_.FullName.Substring($origem.Length + 1).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relativo) | Out-Null
  }
} finally {
  $zip.Dispose()
}

$tamanho = [math]::Round((Get-Item $destino).Length / 1MB, 2)
Write-Host "deploy.zip pronto ($tamanho MB)"
