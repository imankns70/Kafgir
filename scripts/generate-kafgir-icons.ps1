param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\branding\generated')
)

Add-Type -AssemblyName System.Drawing

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$brandingRoot = Join-Path $repoRoot 'branding'
$sourcePath = Join-Path $brandingRoot 'logo.png'
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$webPublic = Join-Path $repoRoot 'apps\web\public'
$webBranding = Join-Path $webPublic 'branding'
$webIllustrations = Join-Path $webPublic 'illustrations'
$adminPublic = Join-Path $repoRoot 'apps\admin\src\renderer\public'
$adminBranding = Join-Path $adminPublic 'branding'
$adminBuild = Join-Path $repoRoot 'apps\admin\build'
$foodPlaceholder = Join-Path $brandingRoot 'illustrations\food-placeholder.svg'

if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "The canonical brand source is missing: $sourcePath"
}

foreach ($directory in @($resolvedOutput, $webBranding, $webIllustrations, $adminBranding, $adminBuild)) {
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
}

function New-RoundedPath(
    [float]$x,
    [float]$y,
    [float]$width,
    [float]$height,
    [float]$radius
) {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = $radius * 2
    $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
    $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-TransparentMaster([System.Drawing.Bitmap]$source) {
    $bitmap = [System.Drawing.Bitmap]::new(
        $source.Width,
        $source.Height,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # The supplied artwork contains an opaque outer canvas. Clip only that canvas
    # away while leaving every pixel inside the rounded app-mark artwork unchanged.
    $insetX = [Math]::Round($source.Width * 0.0335)
    $insetY = [Math]::Round($source.Height * 0.0335)
    $markWidth = $source.Width - ($insetX * 2)
    $markHeight = $source.Height - ($insetY * 2)
    $radius = [Math]::Round($markWidth * 0.122)
    $clip = New-RoundedPath $insetX $insetY $markWidth $markHeight $radius
    $graphics.SetClip($clip)
    $graphics.DrawImageUnscaled($source, 0, 0)

    $clip.Dispose()
    $graphics.Dispose()
    return $bitmap
}

function New-ResizedBitmap(
    [System.Drawing.Bitmap]$source,
    [int]$size
) {
    $bitmap = [System.Drawing.Bitmap]::new(
        $size,
        $size,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage(
        $source,
        [System.Drawing.Rectangle]::new(0, 0, $size, $size),
        0,
        0,
        $source.Width,
        $source.Height,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $graphics.Dispose()
    return $bitmap
}

function Save-Png(
    [System.Drawing.Bitmap]$bitmap,
    [string]$path
) {
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Write-MultiResolutionIcon(
    [string]$path,
    [object[]]$frames
) {
    $file = [System.IO.File]::Create($path)
    $writer = [System.IO.BinaryWriter]::new($file)
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$frames.Count)
    $offset = 6 + (16 * $frames.Count)

    foreach ($frame in $frames) {
        $dimension = if ($frame.Size -eq 256) { 0 } else { $frame.Size }
        $writer.Write([byte]$dimension)
        $writer.Write([byte]$dimension)
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]32)
        $writer.Write([uint32]$frame.Bytes.Length)
        $writer.Write([uint32]$offset)
        $offset += $frame.Bytes.Length
    }

    foreach ($frame in $frames) {
        $writer.Write($frame.Bytes)
    }

    $writer.Dispose()
    $file.Dispose()
}

$source = [System.Drawing.Bitmap]::new($sourcePath)
$master = New-TransparentMaster $source
$transparentMasterPath = Join-Path $resolvedOutput 'logo-transparent.png'
Save-Png $master $transparentMasterPath

$runtimeLogo = New-ResizedBitmap $master 512
Save-Png $runtimeLogo (Join-Path $webBranding 'logo.png')
Save-Png $runtimeLogo (Join-Path $adminBranding 'logo.png')
Save-Png $runtimeLogo (Join-Path $resolvedOutput 'logo-512.png')
$runtimeLogo.Dispose()

if (Test-Path -LiteralPath $foodPlaceholder) {
    Copy-Item -Force -LiteralPath $foodPlaceholder -Destination (Join-Path $webIllustrations 'food-placeholder.svg')
}

$sizes = @(16, 24, 32, 48, 64, 128, 180, 192, 256, 512)
$iconFrames = @()
foreach ($size in $sizes) {
    $bitmap = New-ResizedBitmap $master $size
    $generatedPath = Join-Path $resolvedOutput "kafgir-app-icon-$size.png"
    Save-Png $bitmap $generatedPath

    if ($size -ne 180) {
        Save-Png $bitmap (Join-Path $webPublic "kafgir-app-icon-$size.png")
    }
    if ($size -le 256 -and $size -ne 180 -and $size -ne 192) {
        $stream = [System.IO.MemoryStream]::new()
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $iconFrames += [pscustomobject]@{ Size = $size; Bytes = $stream.ToArray() }
        $stream.Dispose()
    }

    switch ($size) {
        16 { Save-Png $bitmap (Join-Path $webPublic 'favicon-16x16.png') }
        32 { Save-Png $bitmap (Join-Path $webPublic 'favicon-32x32.png') }
        180 { Save-Png $bitmap (Join-Path $webPublic 'apple-touch-icon.png') }
    }
    $bitmap.Dispose()
}

$icoPath = Join-Path $resolvedOutput 'kafgir.ico'
Write-MultiResolutionIcon $icoPath $iconFrames
Copy-Item -Force -LiteralPath $icoPath -Destination (Join-Path $webPublic 'favicon.ico')
Copy-Item -Force -LiteralPath $icoPath -Destination (Join-Path $adminBuild 'kafgir.ico')

$source.Dispose()
$master.Dispose()

Write-Output "Generated all Kafgir identity assets from $sourcePath"
