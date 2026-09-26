$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 5175
$types = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json"
}

function Send-Response($stream, $status, $contentType, [byte[]]$bytes) {
  $header = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`nAccess-Control-Allow-Origin: *`r`n`r`n"
  $head = [Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($head, 0, $head.Length)
  if ($bytes.Length -gt 0) { $stream.Write($bytes, 0, $bytes.Length) }
}

function Handle-Client($client) {
  $stream = $null
  try {
    $client.ReceiveTimeout = 4000
    $client.SendTimeout = 4000
    $stream = $client.GetStream()
    $buffer = New-Object byte[] 8192
    $read = $stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) { return }
    $text = [Text.Encoding]::ASCII.GetString($buffer, 0, $read)
    $line = ($text -split "`r`n")[0]
    $parts = $line -split " "
    $rawPath = if ($parts.Length -ge 2) { $parts[1] } else { "/" }
    $rawPath = ($rawPath -split "\?", 2)[0]
    $rawPath = [Uri]::UnescapeDataString($rawPath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($rawPath)) { $rawPath = "index.html" }
    $full = [IO.Path]::GetFullPath((Join-Path $root $rawPath))
    $rootFull = [IO.Path]::GetFullPath($root)
    if (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
      Send-Response $stream "403 Forbidden" "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("forbidden"))
      return
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
      Send-Response $stream "404 Not Found" "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("not found"))
      return
    }
    $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
    $type = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
    Send-Response $stream "200 OK" $type ([IO.File]::ReadAllBytes($full))
  } catch {
    Write-Output $_
  } finally {
    if ($stream) { $stream.Close() }
    $client.Close()
  }
}

$listen = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::IPv6Any, $port)
$listen.Server.DualMode = $true
$listen.Start()
Write-Output "Serving $root at http://127.0.0.1:$port/ and http://localhost:$port/"

while ($true) {
  $client = $listen.AcceptTcpClient()
  Handle-Client $client
}
