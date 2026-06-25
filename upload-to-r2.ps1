# upload-to-r2.ps1
# Uploads ALL assets/images/ files to the bkdziti-assets R2 bucket.
# Run this once (or any time you add new media files).
# Requires: npx wrangler available and authenticated (wrangler login)

$bucket = "bkdziti-assets"
$folder = "$PSScriptRoot\assets\images"

# Upload every file in assets/images/ automatically
$files = Get-ChildItem -Path $folder -File | Select-Object -ExpandProperty Name

$total = $files.Count
$i = 0
$errors = @()

foreach ($file in $files) {
    $i++
    $path = Join-Path $folder $file
    Write-Host "[$i/$total] $file" -ForegroundColor Cyan
    $result = npx wrangler r2 object put "$bucket/$file" --file $path --remote 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: $result" -ForegroundColor Red
        $errors += $file
    } else {
        Write-Host "  OK" -ForegroundColor Green
    }
}

Write-Host "`n=== DONE: $($total - $errors.Count)/$total uploaded ===" -ForegroundColor White
if ($errors.Count -gt 0) {
    Write-Host "Failed: $($errors -join ', ')" -ForegroundColor Red
}
