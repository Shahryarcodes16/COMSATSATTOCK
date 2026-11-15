Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\shahryar\.gemini\antigravity\brain\7a209f6f-6ae9-4a4b-bf03-48d95754aa72\.user_uploaded\media_1794720330118_1935b32a.jpg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# The icon squircle is exactly located at x=24..316, y=24..316 (292x292)
$cropRect = New-Object System.Drawing.Rectangle(24, 24, 292, 292)
$rawIcon = New-Object System.Drawing.Bitmap(292, 292, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($rawIcon)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($src, 0, 0, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

# Create squircle clip path with anti-aliasing
$r = 58 # radius of rounded corner
$d = $r * 2
$w = 292
$h = 292
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $d, $d, 180, 90)
$path.AddArc($w - $d, 0, $d, $d, 270, 90)
$path.AddArc($w - $d, $h - $d, $d, $d, 0, 90)
$path.AddArc(0, $h - $d, $d, $d, 90, 90)
$path.CloseFigure()

# Generate 1: Clean Original Icon with transparent background
$origTransparent = New-Object System.Drawing.Bitmap(292, 292, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gOrig = [System.Drawing.Graphics]::FromImage($origTransparent)
$gOrig.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gOrig.Clip = New-Object System.Drawing.Region($path)
$gOrig.DrawImage($rawIcon, 0, 0)
$gOrig.Dispose()

# Generate 2: Application-Color Adjusted Icon
# Our application's signature palette:
# Top: Deep Navy Teal #0e2837 (R:14, G:40, B:55)
# Bottom: Campus Teal #087f79 (R:8, G:127, B:121) or Deep Teal #0d4652 (R:13, G:70, B:82)
# Preserves:
# - Academic block building walls (cream/beige)
# - Building window pillars (forest green)
# - Terracotta arch & roof cornice (amber/rust)
# - Front lawn (vibrant green)
# - Trees (deep green)
# - Notification bell badge in top right: white circle with notification bell & red alert dot

$adjustedIcon = New-Object System.Drawing.Bitmap(292, 292, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gAdj = [System.Drawing.Graphics]::FromImage($adjustedIcon)
$gAdj.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gAdj.Clip = New-Object System.Drawing.Region($path)
$gAdj.DrawImage($rawIcon, 0, 0)
$gAdj.Dispose()

# Badge center is roughly around x=265, y=60, radius=32
$badgeCenterX = 265
$badgeCenterY = 60
$badgeRadiusSq = 34 * 34

for ($y = 0; $y -lt 292; $y++) {
    $t = $y / 292.0
    # Gradient from #0d2838 (top) to #094754 / #08646b (bottom)
    $bgR = [int](13 + (8 - 13) * $t)
    $bgG = [int](38 + (90 - 38) * $t)
    $bgB = [int](56 + (92 - 56) * $t)

    for ($x = 0; $x -lt 292; $x++) {
        $p = $adjustedIcon.GetPixel($x, $y)
        if ($p.A -gt 0) {
            # Skip if inside or near the notification badge
            $dx = $x - $badgeCenterX
            $dy = $y - $badgeCenterY
            if (($dx * $dx + $dy * $dy) -lt $badgeRadiusSq) {
                continue
            }

            # Check if this pixel is part of the blue sky/background:
            # Blue sky has strong blue dominance: B > 95, B > R * 1.5, B > G * 1.15
            $isBlueBg = ($p.B -gt 85) -and ($p.B -gt ($p.R * 1.45)) -and ($p.B -gt ($p.G * 1.12))
            
            if ($isBlueBg) {
                # Compute relative luminance of sky gradient
                $luma = ($p.R * 0.2126 + $p.G * 0.7152 + $p.B * 0.0722) / 255.0
                # Scale background color by original lighting intensity
                $factor = 0.75 + ($luma * 0.7)
                $finalR = [Math]::Min(255, [int]($bgR * $factor))
                $finalG = [Math]::Min(255, [int]($bgG * $factor))
                $finalB = [Math]::Min(255, [int]($bgB * $factor))
                $adjustedIcon.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, $finalR, $finalG, $finalB))
            }
        }
    }
}

# Save in various sizes and locations
$assetsDir = "C:\Users\shahryar\.gemini\antigravity\scratch\COMSATSATTOCK\src\assets"
$publicDir = "C:\Users\shahryar\.gemini\antigravity\scratch\COMSATSATTOCK\public"

# Save 292x292
$adjustedIcon.Save("$assetsDir\fortis-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$adjustedIcon.Save("$publicDir\fortis-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Replace crest.png with new FORTIS icon in both assets and public
$adjustedIcon.Save("$assetsDir\crest.png", [System.Drawing.Imaging.ImageFormat]::Png)
$adjustedIcon.Save("$publicDir\crest.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Generate 512x512 PWA icon
$bmp512 = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g512 = [System.Drawing.Graphics]::FromImage($bmp512)
$g512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g512.DrawImage($adjustedIcon, 0, 0, 512, 512)
$g512.Dispose()
$bmp512.Save("$publicDir\pwa-512x512.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Generate 192x192 PWA icon
$bmp192 = New-Object System.Drawing.Bitmap(192, 192, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g192 = [System.Drawing.Graphics]::FromImage($bmp192)
$g192.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g192.DrawImage($adjustedIcon, 0, 0, 192, 192)
$g192.Dispose()
$bmp192.Save("$publicDir\pwa-192x192.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Also save the full horizontal logo (with FORTIS text and acronym)
$fullRect = New-Object System.Drawing.Rectangle(15, 15, 990, 310)
$fullBmp = New-Object System.Drawing.Bitmap(990, 310, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gFull = [System.Drawing.Graphics]::FromImage($fullBmp)
$gFull.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gFull.DrawImage($src, 0, 0, $fullRect, [System.Drawing.GraphicsUnit]::Pixel)
$gFull.Dispose()
$fullBmp.Save("$assetsDir\fortis-logo-full.png", [System.Drawing.Imaging.ImageFormat]::Png)
$fullBmp.Save("$publicDir\fortis-logo-full.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Also copy to artifact dir so user can preview directly
$artDir = "C:\Users\shahryar\.gemini\antigravity\brain\7a209f6f-6ae9-4a4b-bf03-48d95754aa72"
$adjustedIcon.Save("$artDir\fortis-icon-adjusted.png", [System.Drawing.Imaging.ImageFormat]::Png)
$origTransparent.Save("$artDir\fortis-icon-original.png", [System.Drawing.Imaging.ImageFormat]::Png)
$fullBmp.Save("$artDir\fortis-logo-full.png", [System.Drawing.Imaging.ImageFormat]::Png)

Write-Output "Successfully generated and saved all FORTIS assets!"

$src.Dispose()
$rawIcon.Dispose()
$origTransparent.Dispose()
$adjustedIcon.Dispose()
$bmp512.Dispose()
$bmp192.Dispose()
$fullBmp.Dispose()
