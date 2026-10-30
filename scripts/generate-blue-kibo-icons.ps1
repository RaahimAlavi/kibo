# scripts/generate-blue-kibo-icons.ps1
Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Clear with transparent
$g.Clear([System.Drawing.Color]::Transparent)

# Draw rounded squircle background (Charcoal #0C0D12)
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 12, 13, 18))
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 52
$d = $r * 2
$w = 256
$h = 256
$path.AddArc(0, 0, $d, $d, 180, 90)
$path.AddArc($w - $d, 0, $d, $d, 270, 90)
$path.AddArc($w - $d, $h - $d, $d, $d, 0, 90)
$path.AddArc(0, $h - $d, $d, $d, 90, 90)
$path.CloseFigure()
$g.FillPath($bgBrush, $path)

# Subtle Cyan Halo
$haloBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 56, 189, 248))
$g.FillEllipse($haloBrush, 36, 60, 184, 160)

# Antenna stick and tip
$antennaPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 2, 132, 199), 10)
$g.DrawLine($antennaPen, 128, 64, 128, 36)
$tipBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
$g.FillEllipse($tipBrush, 118, 26, 20, 20)
$tipCoreBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$g.FillEllipse($tipCoreBrush, 123, 31, 10, 10)

# Droid Blue Body (MK-1 Celestial Blue Gradient #38BDF8 to #0284C7)
$bodyRect = New-Object System.Drawing.Rectangle(44, 62, 168, 150)
$bodyBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bodyRect,
    [System.Drawing.Color]::FromArgb(255, 56, 189, 248),
    [System.Drawing.Color]::FromArgb(255, 2, 132, 199),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$g.FillEllipse($bodyBrush, 44, 62, 168, 150)

# Rim highlight
$rimPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 224, 242, 254), 3)
$g.DrawEllipse($rimPen, 45, 63, 166, 148)

# Top Specular sheen
$sheenBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(65, 255, 255, 255))
$g.FillEllipse($sheenBrush, 76, 70, 104, 24)

# Dark Glossy Visor (#090D15)
$visorBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 9, 13, 21))
$visorRect = New-Object System.Drawing.Rectangle(64, 104, 128, 76)
$g.FillEllipse($visorBrush, $visorRect)
$visorBorderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 56, 189, 248), 2)
$g.DrawEllipse($visorBorderPen, $visorRect)

# Glowing Cyan LED Eyes (MK-1 Core #E0F2FE with Cyan Aura)
$eyeGlowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 56, 189, 248))
$g.FillEllipse($eyeGlowBrush, 84, 118, 28, 44)
$g.FillEllipse($eyeGlowBrush, 144, 118, 28, 44)

# Main LED Eye Capsules
$eyeCoreBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 224, 242, 254))
$g.FillEllipse($eyeCoreBrush, 88, 122, 20, 36)
$g.FillEllipse($eyeCoreBrush, 148, 122, 20, 36)

# Eye Highlights
$eyeHlBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$g.FillEllipse($eyeHlBrush, 91, 125, 8, 14)
$g.FillEllipse($eyeHlBrush, 151, 125, 8, 14)

# Tiny Smile LED Accent
$smilePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 56, 189, 248), 2.5)
$g.DrawArc($smilePen, 121, 156, 14, 10, 0, 180)

$g.Dispose()

# Save PNGs
$publicDir = "public"
$pngPath = Join-Path $publicDir "icon-256.png"
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$favPngPath = Join-Path $publicDir "favicon.png"
$bmp.Save($favPngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Generate multi-size ICO
$icoPath = Join-Path $publicDir "favicon.ico"
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$bmp.Dispose()

Write-Output "Successfully generated blue Kibo icons at $pngPath and $icoPath"
