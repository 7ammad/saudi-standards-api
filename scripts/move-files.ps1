# PowerShell script to move JSON files from json_files to data directory

$sourceDir = Join-Path $PSScriptRoot "..\json_files"
$targetDir = Join-Path $PSScriptRoot "..\data"

# Create data directory if it doesn't exist
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
    Write-Host "Created data directory"
}

# Get all JSON files
$jsonFiles = Get-ChildItem -Path $sourceDir -Filter "*.json"

if ($jsonFiles.Count -eq 0) {
    Write-Host "No JSON files found in json_files directory"
    exit
}

Write-Host "Moving $($jsonFiles.Count) JSON files to data directory..."

foreach ($file in $jsonFiles) {
    $targetPath = Join-Path $targetDir $file.Name
    if (Test-Path $targetPath) {
        Write-Host "Skipping $($file.Name) - already exists in data directory"
    } else {
        Move-Item -Path $file.FullName -Destination $targetPath
        Write-Host "Moved $($file.Name)"
    }
}

Write-Host "Done! Files are now in the data directory."

