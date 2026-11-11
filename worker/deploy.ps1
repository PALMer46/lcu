# LCU API deploy to Cloudflare (D1 + Worker) using the REST API - no Node/wrangler needed.
# Usage: $env:LCU_CF_TOKEN='<token>'; powershell -ExecutionPolicy Bypass -File .\deploy.ps1
# Files expected next to this script: index.js, schema.sql, seed.sql, and (optional, PRIVATE) lustzone-data.json
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Token = $env:LCU_CF_TOKEN; if (-not $Token) { $Token = Read-Host 'Cloudflare API token' }
$H = @{ Authorization = "Bearer $Token" }
$Api = 'https://api.cloudflare.com/client/v4'
$ScriptName = 'lcu-api'; $DbName = 'lcu'; $Origins = 'https://palmer46.github.io'

function CF($Method, $Path, $Body) {
  $p = @{ Method = $Method; Uri = "$Api$Path"; Headers = $H }
  if ($null -ne $Body) { $p.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 20 -Compress)); $p.ContentType = 'application/json; charset=utf-8' }
  $r = Invoke-RestMethod @p
  if (-not $r.success) { throw ("Cloudflare error: " + ($r.errors | ConvertTo-Json -Compress)) }
  return $r.result
}
function ReadUtf8($name) { return [IO.File]::ReadAllText((Join-Path $Here $name), [Text.Encoding]::UTF8) }

# 1) account + workers.dev subdomain
$acc = (CF GET '/accounts')[0].id
Write-Host "account: $acc"
$sub = $null; try { $sub = (CF GET "/accounts/$acc/workers/subdomain").subdomain } catch { Write-Host "subdomain lookup: $_" }
if (-not $sub) {
  foreach ($cand in @('palmer46', 'lcu-palmer46', 'lowclassuniverse')) {
    try { $sub = (CF PUT "/accounts/$acc/workers/subdomain" @{ subdomain = $cand }).subdomain; Write-Host "workers.dev subdomain created: $sub"; break } catch { Write-Host "subdomain '$cand' not available: $_" }
  }
}
if (-not $sub) { throw 'workers.dev subdomain is not set up yet: open dash.cloudflare.com > Workers & Pages once and choose a subdomain, then run again.' }
Write-Host "workers.dev subdomain: $sub"

# 2) D1 database
$db = (CF GET "/accounts/$acc/d1/database?name=$DbName") | Where-Object { $_.name -eq $DbName } | Select-Object -First 1
if (-not $db) { $db = CF POST "/accounts/$acc/d1/database" @{ name = $DbName }; Write-Host 'D1 database created' } else { Write-Host 'D1 database exists' }
$dbid = $db.uuid
function Q($sql, $params) { $b = @{ sql = $sql }; if ($params) { $b.params = @($params) }; return CF POST "/accounts/$acc/d1/database/$dbid/query" $b }
function RunFile($name, [switch]$StripComments) {
  $text = ReadUtf8 $name
  $text = ($text -split "`n" | Where-Object { -not $_.TrimStart().StartsWith('--') } | ForEach-Object { if ($StripComments) { $_ -replace '\s--\s.*$', '' } else { $_ } }) -join "`n"
  $n = 0
  foreach ($stmt in ($text -split ";\s*(?:\r?\n|$)")) { $s = $stmt.Trim(); if ($s -and $s -notmatch '^\r?\n?$' -and $s -notmatch '^PRAGMA') { Q $s $null | Out-Null; $n++ } }
  Write-Host "$name : $n statements"
}
RunFile 'schema.sql' -StripComments
RunFile 'seed.sql'

# 3) LUSTZONE content (private) -> D1 only
$lzFile = Join-Path $Here 'lustzone-data.json'
if (Test-Path $lzFile) {
  $lz = [IO.File]::ReadAllText($lzFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
  foreach ($n in $lz.novels) {
    Q "INSERT INTO novels (id,title,slug,description,cover_url,author,volume_id,category_id,status,published_at,updated_at) VALUES (?1,?2,?3,NULL,NULL,NULL,NULL,'lustzone',?4,?5,?5) ON CONFLICT(id) DO UPDATE SET title=excluded.title, status=excluded.status, updated_at=excluded.updated_at" @($n.id, $n.title, $n.slug, $n.status, $n.updated_at) | Out-Null
    if ($n.cover) { Q "INSERT INTO lz_covers (novel_id,mime,data) VALUES (?1,?2,?3) ON CONFLICT(novel_id) DO UPDATE SET mime=excluded.mime, data=excluded.data" @($n.id, $n.cover.mime, $n.cover.data) | Out-Null }
    foreach ($c in $n.chapters) {
      $content = ConvertTo-Json -InputObject @($c.blocks) -Depth 6 -Compress
      Q "INSERT INTO chapters (id,novel_id,chapter_number,title,content,published_at,updated_at,is_published) VALUES (?1,?2,?3,?4,?5,?6,?6,1) ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, updated_at=excluded.updated_at, is_published=1" @("$($n.id):$($c.n)", $n.id, [int]$c.n, $c.title, $content, $n.updated_at) | Out-Null
    }
    Write-Host "LUSTZONE: $($n.title) - $($n.chapters.Count) chapters"
  }
}

# 4) Worker script with bindings (secrets generated here, never stored on disk)
$secret1 = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
$secret2 = ([guid]::NewGuid().ToString('N'))
$meta = @{ main_module = 'index.js'; compatibility_date = '2026-10-01'; bindings = @(
  @{ type = 'd1'; name = 'DB'; id = $dbid },
  @{ type = 'plain_text'; name = 'ALLOWED_ORIGINS'; text = $Origins },
  @{ type = 'plain_text'; name = 'DEDUPE_MINUTES'; text = '30' },
  @{ type = 'plain_text'; name = 'RATE_LIMIT_PER_MIN'; text = '60' },
  @{ type = 'plain_text'; name = 'AGE_TOKEN_DAYS'; text = '30' },
  @{ type = 'secret_text'; name = 'AGE_SECRET'; text = $secret1 },
  @{ type = 'secret_text'; name = 'IP_SALT'; text = $secret2 }
) } | ConvertTo-Json -Depth 6 -Compress
$code = ReadUtf8 'index.js'
$bd = '----lcu' + [guid]::NewGuid().ToString('N')
$sb = New-Object Text.StringBuilder
[void]$sb.Append("--$bd`r`nContent-Disposition: form-data; name=`"metadata`"`r`nContent-Type: application/json`r`n`r`n$meta`r`n")
[void]$sb.Append("--$bd`r`nContent-Disposition: form-data; name=`"index.js`"; filename=`"index.js`"`r`nContent-Type: application/javascript+module`r`n`r`n$code`r`n--$bd--`r`n")
$r = Invoke-RestMethod -Method PUT -Uri "$Api/accounts/$acc/workers/scripts/$ScriptName" -Headers $H -ContentType "multipart/form-data; boundary=$bd" -Body ([Text.Encoding]::UTF8.GetBytes($sb.ToString()))
if (-not $r.success) { throw ("Worker upload failed: " + ($r.errors | ConvertTo-Json -Compress)) }
Write-Host 'Worker uploaded'
CF POST "/accounts/$acc/workers/scripts/$ScriptName/subdomain" @{ enabled = $true; previews_enabled = $false } | Out-Null
$url = "https://$ScriptName.$sub.workers.dev"
Write-Host "API_URL=$url" -ForegroundColor Green
Start-Sleep -Seconds 8
try { $s = Invoke-RestMethod "$url/v1/stats?scope=global"; Write-Host ("health: novels=" + $s.novels + " chapters=" + $s.chapters) } catch { Write-Host "health check pending: $_" }
Write-Host 'ALL DONE'
