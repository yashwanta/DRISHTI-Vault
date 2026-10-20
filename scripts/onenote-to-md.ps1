# onenote-to-md.ps1
# Converts .docx files (exported from OneNote) to Markdown using Pandoc
# Usage: powershell -ExecutionPolicy Bypass -File scripts\onenote-to-md.ps1
#        [-InputDir <path>] [-OutputDir <path>]

param(
    [string]$InputDir  = "C:\Temp\OneNote-Export",
    [string]$OutputDir = "C:\DRISHTI\DRISHTI-Vault\Notes\600-Archive\OneNote"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DRISHTI Notes — OneNote Migration"     -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Check Pandoc is installed ---
$pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
if (-not $pandoc) {
    Write-Host "[ERROR] Pandoc not found. Install it first:" -ForegroundColor Red
    Write-Host "  winget install JohnMacFarlane.Pandoc" -ForegroundColor Yellow
    Write-Host "  Then re-run this script." -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Pandoc found: $($pandoc.Source)" -ForegroundColor Green

# --- Check input directory ---
if (-not (Test-Path $InputDir)) {
    Write-Host "[ERROR] Input directory not found: $InputDir" -ForegroundColor Red
    Write-Host "  Export your OneNote sections as .docx files to that folder first." -ForegroundColor Yellow
    exit 1
}

# --- Create output directory ---
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "[OK] Created output directory: $OutputDir" -ForegroundColor Green
}

# --- Create attachments directory ---
$attachDir = Join-Path $OutputDir "_images"
if (-not (Test-Path $attachDir)) {
    New-Item -ItemType Directory -Path $attachDir -Force | Out-Null
}

# --- Find all .docx files ---
$files = Get-ChildItem -Path $InputDir -Filter "*.docx" -Recurse
if ($files.Count -eq 0) {
    Write-Host "[WARN] No .docx files found in $InputDir" -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($files.Count) .docx files to convert." -ForegroundColor Cyan
Write-Host ""

$converted = 0
$failed    = 0

foreach ($file in $files) {
    # Build output path, preserving subfolder structure
    $relative  = $file.FullName.Substring($InputDir.Length).TrimStart('\', '/')
    $mdName    = [System.IO.Path]::ChangeExtension($relative, ".md")
    $outPath   = Join-Path $OutputDir $mdName
    $outFolder = Split-Path $outPath -Parent

    if (-not (Test-Path $outFolder)) {
        New-Item -ItemType Directory -Path $outFolder -Force | Out-Null
    }

    Write-Host "  Converting: $($file.Name)" -NoNewline

    try {
        # Run pandoc: docx → markdown with extracted media
        $mediaDir = Join-Path $outFolder "_images_$($file.BaseName)"
        & pandoc $file.FullName `
            -o $outPath `
            --from docx `
            --to markdown+yaml_metadata_block `
            --wrap=none `
            --extract-media=$mediaDir `
            2>$null

        if ($LASTEXITCODE -eq 0) {
            # Prepend frontmatter
            $today    = Get-Date -Format "yyyy-MM-dd"
            $header   = @"
---
date: $today
tags: [migrated, onenote]
original-file: $($file.Name)
---

"@
            $content  = Get-Content $outPath -Raw -Encoding UTF8
            # Remove any existing pandoc yaml block if present
            $content  = $content -replace "^---[\s\S]*?---\r?\n", ""
            Set-Content -Path $outPath -Value ($header + $content.TrimStart()) -Encoding UTF8

            Write-Host " ✓" -ForegroundColor Green
            $converted++
        } else {
            Write-Host " ✗ (pandoc error)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host " ✗ ($_)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Converted : $converted" -ForegroundColor Green
Write-Host "  Failed    : $failed"    -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "  Output    : $OutputDir" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open Obsidian and browse Notes\600-Archive\OneNote\"
Write-Host "  2. Review each note — fix formatting if needed"
Write-Host "  3. Move notes to the correct vault folder:"
Write-Host "       Incidents  → 400-Incidents\"
Write-Host "       Projects   → 200-Projects\"
Write-Host "       Meetings   → 300-Meetings\"
Write-Host "       Reference  → 500-Reference\"
Write-Host "  4. See: Notes\600-Archive\OneNote Migration Guide.md"
Write-Host ""
