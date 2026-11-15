Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\shahryar\.gemini\antigravity\brain\7a209f6f-6ae9-4a4b-bf03-48d95754aa72\.user_uploaded\media_1794720330118_1935b32a.jpg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# 1. Crop original squircle (24, 24, 292, 292)
$cropRect = New-Object System.Drawing.Rectangle(24, 24, 292, 292)
$iconBmp = New-Object System.Drawing.Bitmap(292, 292, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($iconBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($src, 0, 0, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

# Make outer white corners transparent:
# Anything outside the squircle radius
# Radius is around 60px
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 62
$d = $r * 2
$w = 292
$h = 292
$path.AddArc(0, 0, $d, $d, 180, 90)
$path.AddArc($w - $d, 0, $d, $d, 270, 90)
$path.AddArc($w - $d, $h - $d, $d, $d, 0, 90)
$path.AddArc(0, $h - $d, $d, $d, 90, 90)
$path.CloseFigure()

$iconTransparent = New-Object System.Drawing.Bitmap(292, 292, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g2 = [System.Drawing.Graphics]::FromImage($iconTransparent)
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g2.Clip = New-Object System.Drawing.Region($path)
$g2.DrawImage($iconBmp, 0, 0)
$g2.Dispose()

$outDir = "C:\Users\shahryar\.gemini\antigravity\scratch\COMSATSATTOCK\src\assets"
$iconTransparent.Save("$outDir\fortis-icon-original.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Saved fortis-icon-original.png"

# 2. Color-adjusted version matching application colors:
# In the original, the blue background has R < 35, G < 95, B > 130
# Application colors:
# App Navy: #0e2433 (top) to #163847 (bottom), with subtle emerald teal #087f79 glow
$adjustedBmp = New-Object System.Drawing.Bitmap($iconTransparent)
for ($y = 0; $y -lt 292; $y++) {
    $t = $y / 292.0
    # Target background gradient: #0d2331 at top, #143544 at bottom (app's exact nav/hero color)
    $targetR = [int](13 + (20 - 13) * $t)
    $targetG = [int](35 + (53 - 35) * $t)
    $targetB = [int](49 + (68 - 49) * $t)

    for ($x = 0; $x -lt 292; $x++) {
        $pixel = $adjustedBmp.GetPixel($x, $y)
        if ($pixel.A -gt 10) {
            # Is this blue background?
            # Blue background has B > 110 and B > R * 1.8 and B > G * 1.3
            if ($pixel.B -gt 100 -and ($pixel.B -gt ($pixel.R * 1.7)) -and ($pixel.B -gt ($pixel.G * 1.25))) {
                # Blend with target background while preserving gradient brightness
                $brightness = ($pixel.R * 0.2 + $pixel.G * 0.3 + $pixel.B * 0.5) / 255.0
                $newR = [Math]::Min(255, [int]($targetR * $brightness * 1.8))
                $newG = [Math]::Min(255, [int]($targetG * $brightness * 2.2 + 10)) # hint of teal
                $newB = [Math]::Min(255, [int]($targetB * $brightness * 1.9 + 12))
                $adjustedBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, $newR, $newG, $newB))
            }
        }
    }
}

$adjustedBmp.Save("$outDir\fortis-icon-adjusted.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Saved fortis-icon-adjusted.png"

# Also save the full banner/logo (with the FORTIS text)
$fullCrop = New-Object System.Drawing.Rectangle(20, 20, 984, 301)
$fullBmp = New-Object System.Drawing.Bitmap(984, 301, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gFull = [System.Drawing.Graphics]::FromImage($fullBmp)
$gFull.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gFull.DrawImage($src, 0, 0, $fullCrop, [System.Drawing.GraphicsUnit]::Pixel)
$gFull.Dispose()
$fullBmp.Save("$outDir\fortis-logo-full.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Saved fortis-logo-full.png"

$src.Dispose()
$iconBmp.Dispose()
$iconTransparent.Dispose()
$adjustedBmp.Dispose()
$fullBmp.Dispose()
