[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$MiniAppUrl,

    [string]$EnvFile = (Join-Path $PSScriptRoot '..\apps\web\.env.local')
)

$ErrorActionPreference = 'Stop'

function Get-LocalEnvironmentValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*#' -or $line -notmatch '=') {
            continue
        }

        $parts = $line -split '=', 2
        if ($parts[0].Trim() -ne $Name) {
            continue
        }

        $value = $parts[1].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        return $value
    }

    return $null
}

function Invoke-TelegramMethod {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Token,

        [hashtable]$Body
    )

    $endpoint = "https://api.telegram.org/bot$Token/$Method"
    try {
        if ($Body) {
            $json = $Body | ConvertTo-Json -Depth 8 -Compress
            $response = Invoke-RestMethod -Uri $endpoint -Method Post -ContentType 'application/json' -Body $json
        }
        else {
            $response = Invoke-RestMethod -Uri $endpoint -Method Get
        }
    }
    catch {
        throw "Telegram $Method failed. Check the bot token and internet connection."
    }

    if (-not $response.ok) {
        throw "Telegram $Method rejected the request."
    }

    return $response.result
}

$parsedUrl = $null
if (-not [Uri]::TryCreate($MiniAppUrl, [UriKind]::Absolute, [ref]$parsedUrl) -or
    $parsedUrl.Scheme -ne 'https') {
    throw 'MiniAppUrl must be an absolute HTTPS URL.'
}

$pinggySuffixes = @(
    '.pinggy.net',
    '.pinggy.link',
    '.run.pinggy-free.link',
    '.free.pinggy.net'
)
$isPinggyHost = $false
foreach ($suffix in $pinggySuffixes) {
    if ($parsedUrl.Host.EndsWith($suffix, [StringComparison]::OrdinalIgnoreCase)) {
        $isPinggyHost = $true
        break
    }
}
if (-not $isPinggyHost) {
    throw 'MiniAppUrl must use one of the Pinggy HTTPS domains allowed by the Kafgir web app.'
}

$normalizedUrl = $parsedUrl.GetLeftPart([UriPartial]::Path).TrimEnd('/')
$healthUrl = "$normalizedUrl/api/health"
try {
    $health = Invoke-RestMethod -Uri $healthUrl -Method Get
}
catch {
    throw 'The Kafgir health endpoint is not reachable through this Pinggy URL. Start npm run dev:web and the tunnel first.'
}
if ($health.status -ne 'ok' -or $health.service -ne 'Kafgir.Web') {
    throw 'The Pinggy URL does not point to a healthy Kafgir web service.'
}

$token = [Environment]::GetEnvironmentVariable('TELEGRAM_BOT_TOKEN')
if ([string]::IsNullOrWhiteSpace($token)) {
    $token = Get-LocalEnvironmentValue -Name 'TELEGRAM_BOT_TOKEN' -Path $EnvFile
}
if ([string]::IsNullOrWhiteSpace($token)) {
    throw 'TELEGRAM_BOT_TOKEN is missing. Add the BotFather token to apps/web/.env.local or the current process environment.'
}

$bot = Invoke-TelegramMethod -Method 'getMe' -Token $token
$null = Invoke-TelegramMethod -Method 'setChatMenuButton' -Token $token -Body @{
    menu_button = @{
        type = 'web_app'
        text = 'باز کردن کفگیر'
        web_app = @{
            url = $normalizedUrl
        }
    }
}

Write-Host 'Kafgir Mini App menu button updated successfully.' -ForegroundColor Green
Write-Host "Bot: @$($bot.username)"
Write-Host "Mini App: $normalizedUrl"
Write-Host "Stable channel link: https://t.me/$($bot.username)"
