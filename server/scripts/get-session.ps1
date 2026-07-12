param(
    [string]$BaseUrl = "http://localhost:3000/api"
)

$ErrorActionPreference = "Stop"

$SessionId = "a4c44abe-ebd3-4938-935b-989cc6b62b8a"

if ($SessionId -eq "a4c44abe-ebd3-4938-935b-989cc6b62b8a") {
    throw "Replace a4c44abe-ebd3-4938-935b-989cc6b62b8a with a real session ID."
}

$Url = "$BaseUrl/sessions/$SessionId"

Write-Host "Getting session:"
Write-Host "  $SessionId"
Write-Host ""

$response = & curl.exe `
    --silent `
    --show-error `
    --fail-with-body `
    --request GET `
    --header "Accept: application/json" `
    $Url

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "API response:"
    Write-Host $response

    throw "GET session request failed."
}

$session = $response | ConvertFrom-Json

Write-Host "Session state:"
$session | ConvertTo-Json -Depth 5