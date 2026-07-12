param(
    [string]$BaseUrl = "http://localhost:3000/api"
)

$ErrorActionPreference = "Stop"

function Invoke-CurlJson {
    param(
        [Parameter(Mandatory)]
        [ValidateSet("GET", "POST")]
        [string]$Method,

        [Parameter(Mandatory)]
        [string]$Url
    )

    $response = & curl.exe `
        --silent `
        --show-error `
        --fail-with-body `
        --request $Method `
        --header "Accept: application/json" `
        $Url

    if ($LASTEXITCODE -ne 0) {
        throw "curl failed for $Method $Url"
    }

    return $response | ConvertFrom-Json
}

Write-Host "1. Checking API and Redis health..."

$health = Invoke-CurlJson `
    -Method GET `
    -Url "$BaseUrl/alive"

if (
    $health.status -ne "ok" -or
    $health.redis -ne "connected" -or
    $health.service -ne "casino-jackpot-api"
) {
    throw "Unexpected health response: $($health | ConvertTo-Json -Compress)"
}

Write-Host "   Health check passed."
Write-Host ""

Write-Host "2. Creating a game session..."

$session = Invoke-CurlJson `
    -Method POST `
    -Url "$BaseUrl/sessions"

if (
    $session.credits -ne 10 -or
    $session.status -ne "active" -or
    [string]::IsNullOrWhiteSpace($session.sessionId)
) {
    throw "Unexpected session response: $($session | ConvertTo-Json -Compress)"
}

$sessionId = $session.sessionId

Write-Host "   Session created: $sessionId"
Write-Host "   Starting credits: $($session.credits)"
Write-Host ""

Write-Host "3. Cashing out the session..."

$cashOut = Invoke-CurlJson `
    -Method POST `
    -Url "$BaseUrl/sessions/$sessionId/cash-out"

if (
    $cashOut.sessionId -ne $sessionId -or
    $cashOut.cashedOutCredits -ne 10 -or
    $cashOut.status -ne "cashed-out"
) {
    throw "Unexpected cash-out response: $($cashOut | ConvertTo-Json -Compress)"
}

Write-Host "   Cashed out: $($cashOut.cashedOutCredits) credits"
Write-Host ""

Write-Host "4. Verifying duplicate cash-out is rejected..."

$tempFile = [System.IO.Path]::GetTempFileName()

try {
    $statusCode = & curl.exe `
        --silent `
        --show-error `
        --output $tempFile `
        --write-out "%{http_code}" `
        --request POST `
        --header "Accept: application/json" `
        "$BaseUrl/sessions/$sessionId/cash-out"

    if ($LASTEXITCODE -ne 0) {
        throw "curl failed while testing duplicate cash-out"
    }

    $errorBody = Get-Content `
        -Path $tempFile `
        -Raw

    if ($statusCode -ne "409") {
        throw "Expected HTTP 409 but received $statusCode. Body: $errorBody"
    }

    $errorResponse = $errorBody | ConvertFrom-Json

    if (
        $errorResponse.response.code -ne "SESSION_ALREADY_CASHED_OUT" -and
        $errorResponse.code -ne "SESSION_ALREADY_CASHED_OUT"
    ) {
        throw "Unexpected duplicate cash-out response: $errorBody"
    }

    Write-Host "   Duplicate cash-out correctly returned HTTP 409."
}
finally {
    Remove-Item `
        -Path $tempFile `
        -Force `
        -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "All API smoke tests passed."