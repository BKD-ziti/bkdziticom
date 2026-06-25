# upload-to-r2.ps1
# Uploads all site media from assets/images/ to the bkdziti-assets R2 bucket.
# Run this once (or any time you add new media files).
# Requires: wrangler installed and authenticated (`wrangler login`)

$bucket = "bkdziti-assets"
$folder = "$PSScriptRoot\assets\images"

$files = @(
    "AZ_resume.pdf",
    "BKDziti Business Card.png",
    "BKDziti Cover 2.png",
    "BKDziti Cover 3.png",
    "BKDziti Cover 4.PNG",
    "BKDziti Cover 5.png",
    "BKDzitiBanner2.png",
    "BKDzitiBanner3.png",
    "BKDzitiLogoOutline.PNG",
    "BKDziti_Logo_Transparent.png",
    "BKDziti_pfp_2.PNG",
    "Card.png",
    "Cover Letter Generic Redux.pdf",
    "Datamosh-Dream.mp4",
    "Datamosh-Dream1.mp4",
    "EatMyBalls.png",
    "EatMyBalls2.PNG",
    "EatMyBallsAdCompressed.mp4",
    "Elotevideo2.mp4",
    "IMG_0326.JPG",
    "IMG_1123.PNG",
    "IMG_2336.JPG",
    "IMG_2339(1).JPG",
    "IMG_2340(1).JPG",
    "IMG_2456.JPG",
    "IMG_8386-0_downscaled.png",
    "IMG_8653.PNG",
    "MP4-converted.mp4",
    "OnigiriBites.mp4",
    "Onigirivideo2.mp4",
    "Twisps1.mp4",
    "bkdziti_intro.mp4",
    "food1.mp4",
    "food2.mp4",
    "image0.jpeg",
    "store.mp4",
    "store0.mp4",
    "store1.mp4",
    "ziti.mp4"
)

$total = $files.Count
$i = 0

foreach ($file in $files) {
    $i++
    $path = Join-Path $folder $file
    if (-not (Test-Path $path)) {
        Write-Host "[$i/$total] SKIP (not found): $file" -ForegroundColor Yellow
        continue
    }
    Write-Host "[$i/$total] Uploading: $file" -ForegroundColor Cyan
    wrangler r2 object put "$bucket/$file" --file $path
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR uploading $file" -ForegroundColor Red
    } else {
        Write-Host "  OK" -ForegroundColor Green
    }
}

Write-Host "`nDone. $total files processed." -ForegroundColor White
