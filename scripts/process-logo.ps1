Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\shahryar\.gemini\antigravity\brain\7a209f6f-6ae9-4a4b-bf03-48d95754aa72\.user_uploaded\media_1794720330118_1935b32a.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

# Check the icon right boundary by checking where white space starts between icon and text
$iconRight = 0
for ($x = 250; $x -lt 400; $x++) {
    $allWhite = $true
    for ($y = 50; $y -lt 300; $y += 5) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -lt 240 -or $p.G -lt 240 -or $p.B -lt 240) {
            $allWhite = $false
            break
        }
    }
    if ($allWhite -and $iconRight -eq 0 -and $x -gt 280) {
        $iconRight = $x
    }
}

Write-Output "Detected icon gap at x=$iconRight"

# Also scan where the text starts
$textLeft = 0
for ($x = $iconRight; $x -lt 500; $x++) {
    for ($y = 50; $y -lt 300; $y += 5) {
        $p = $img.GetPixel($x, $y)
        if ($p.R -lt 240 -or $p.G -lt 240 -or $p.B -lt 240) {
            $textLeft = $x
            break
        }
    }
    if ($textLeft -gt 0) { break }
}

Write-Output "Detected text starting at x=$textLeft"
$img.Dispose()

