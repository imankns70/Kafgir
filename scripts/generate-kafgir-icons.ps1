param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\branding\generated')
)

Add-Type -AssemblyName System.Drawing

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$brandingRoot = Join-Path $repoRoot 'branding'
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$frontendPublic = Join-Path $repoRoot 'frontend\Kafgir.MiniApp\public'
$frontendBranding = Join-Path $frontendPublic 'branding'
$wpfBrandDirectory = Join-Path $repoRoot 'backend\src\Kafgir.WPF\Assets\Brand'
$wpfThemeDirectory = Join-Path $repoRoot 'backend\src\Kafgir.WPF\Themes\Kafgir'

foreach ($directory in @($brandingRoot, $resolvedOutput, $frontendBranding, $wpfBrandDirectory, $wpfThemeDirectory)) {
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
}

function Write-Utf8NoBom([string]$path, [string]$content) {
    [System.IO.File]::WriteAllText($path, $content.Trim() + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

function New-RoundedPath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = [Math]::Max(1, $radius * 2)
    $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
    $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

$symbolSvg = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 112" role="img" aria-labelledby="title">
  <title id="title">Kafgir slotted spatula symbol</title>
  <style>
    @media (max-width: 20px) {
      .symbol-detail,
      .symbol-decoration { display: none; }
    }
  </style>
  <g transform="rotate(8 50 56)">
    <path d="M31 6h36q8 0 8 8l-3 32q-1 8-9 8H35q-8 0-9-8l-3-32q0-8 8-8Z" fill="#2B2B2B"/>
    <g fill="#FFF3E2">
      <rect x="31" y="16" width="4" height="29" rx="2"/>
      <rect x="41" y="16" width="4" height="29" rx="2"/>
      <rect x="51" y="16" width="4" height="29" rx="2"/>
      <rect x="61" y="16" width="4" height="29" rx="2"/>
    </g>
    <path d="M42 53h14l-1 11H43Z" fill="#2B2B2B"/>
    <path d="M42 62q7-2 14 0l.5 36q.5 6-6.5 8-7-.5-7.5-7Z" fill="#B8793D"/>
    <path class="symbol-detail" d="M53 66l.5 31q0 4-3.5 6" fill="none" stroke="#2B2B2B" stroke-width="1.5" stroke-linecap="round" opacity=".18"/>
    <circle cx="50" cy="99" r="2" fill="#FFF3E2"/>
    <g class="symbol-decoration">
      <path d="M55 96q14 0 24-12" fill="none" stroke="#6F7F4E" stroke-width="2.5" stroke-linecap="round"/>
      <g fill="#6F7F4E">
        <path d="M62 94q2-8 8-10 0 7-8 10Z"/>
        <path d="M69 90q7-2 11 2-6 4-11-2Z"/>
      </g>
      <circle cx="79" cy="76" r="2.2" fill="#F2B233"/>
    </g>
  </g>
</svg>
'@

$symbolLightSvg = $symbolSvg.Replace('#2B2B2B', '#FFFDF9').Replace('#FFF3E2', '#617044').Replace('#B8793D', '#FFF3E2').Replace('#D9A160', '#EADCC0').Replace('#465431', '#FFFDF9')
$symbolDarkSvg = $symbolSvg
$symbolSmallSvg = $symbolSvg

$appIconSvg = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title">
  <title id="title">Kafgir app icon</title>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="#E46A4A"/>
  <circle cx="256" cy="254" r="178" fill="#FFF3E2"/>
  <circle cx="256" cy="254" r="158" fill="none" stroke="#EADCC0" stroke-width="5"/>
  <g transform="translate(91 72) scale(3.15)">
    <g transform="rotate(8 50 56)">
      <path d="M31 6h36q8 0 8 8l-3 32q-1 8-9 8H35q-8 0-9-8l-3-32q0-8 8-8Z" fill="#2B2B2B"/>
      <g fill="#FFF3E2">
        <rect x="31" y="16" width="4" height="29" rx="2"/>
        <rect x="41" y="16" width="4" height="29" rx="2"/>
        <rect x="51" y="16" width="4" height="29" rx="2"/>
        <rect x="61" y="16" width="4" height="29" rx="2"/>
      </g>
      <path d="M42 53h14l-1 11H43Z" fill="#2B2B2B"/>
      <path d="M42 62q7-2 14 0l.5 36q.5 6-6.5 8-7-.5-7.5-7Z" fill="#B8793D"/>
      <path d="M53 66l.5 31q0 4-3.5 6" fill="none" stroke="#2B2B2B" stroke-width="1.5" stroke-linecap="round" opacity=".18"/>
      <circle cx="50" cy="99" r="2" fill="#FFF3E2"/>
    </g>
    <path d="M55 96q14 0 24-12" fill="none" stroke="#6F7F4E" stroke-width="2.5" stroke-linecap="round"/>
    <g fill="#6F7F4E">
      <path d="M62 94q2-8 8-10 0 7-8 10Z"/>
      <path d="M69 90q7-2 11 2-6 4-11-2Z"/>
    </g>
    <circle cx="79" cy="76" r="2.2" fill="#F2B233"/>
  </g>
</svg>
'@

$badgeSvg = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-labelledby="title">
  <title id="title">Kafgir brand badge</title>
  <circle cx="120" cy="120" r="106" fill="#6F7F4E"/>
  <circle cx="120" cy="120" r="96" fill="#FFF3E2"/>
  <circle cx="120" cy="120" r="83" fill="none" stroke="#EADCC0" stroke-width="3"/>
  <g transform="translate(43 22) scale(.7)">
    <g transform="rotate(11 108 121)">
      <path d="M56 13Q60 4 74 7l86 22q14 4 10 18l-22 82q-4 14-18 10l-84-21q-13-4-9-17Z" fill="#2B2B2B"/>
      <g fill="#FFF3E2">
        <rect x="62" y="31" width="10" height="64" rx="5"/>
        <rect x="84" y="29" width="10" height="72" rx="5"/>
        <rect x="106" y="33" width="10" height="72" rx="5"/>
        <rect x="128" y="39" width="10" height="64" rx="5"/>
      </g>
      <path d="m78 121 31 8-6 24-31-8Z" fill="#2B2B2B"/>
      <path d="m73 139 32 8-17 84q-3 15-17 13-15-3-12-18Z" fill="#B8793D"/>
      <circle cx="74" cy="225" r="5" fill="#FFF3E2"/>
    </g>
    <path d="M104 221c28-8 55-28 75-58" fill="none" stroke="#6F7F4E" stroke-width="5" stroke-linecap="round"/>
    <g fill="#6F7F4E">
      <path d="M126 208c3-20 13-31 29-34 0 17-10 29-29 34Z"/>
      <path d="M145 195c17-3 29 1 37 13-15 6-28 2-37-13Z"/>
      <path d="M160 177c1-18 9-29 23-34 3 15-5 27-23 34Z"/>
    </g>
  </g>
  <g fill="#E46A4A"><path d="m36 118 5 5-5 5-5-5Z"/><path d="m204 118 5 5-5 5-5-5Z"/></g>
</svg>
'@

$foodPlaceholderSvg = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" role="img" aria-labelledby="title">
  <title id="title">Food image placeholder</title>
  <ellipse cx="120" cy="101" rx="87" ry="25" fill="#FFF3E2" stroke="#CBB997" stroke-width="3"/>
  <ellipse cx="120" cy="99" rx="61" ry="16" fill="none" stroke="#EADCC0" stroke-width="2.5"/>
  <path d="M64 96c8-48 104-48 112 0" fill="#FFF3E2" stroke="#CBB997" stroke-width="3"/>
  <path d="M120 46v7" fill="none" stroke="#CBB997" stroke-width="3" stroke-linecap="round"/>
  <circle cx="120" cy="43" r="4" fill="#CBB997"/>
  <path d="M83 67c-9-12-4-23 6-31M120 62c-8-12-3-22 7-29M157 67c-9-12-4-23 6-31"
        fill="none" stroke="#B8793D" stroke-width="3" stroke-linecap="round"/>
  <path d="M47 105c-19 1-33 11-40 28 18-2 32-11 40-28Z" fill="#6F7F4E" opacity=".82"/>
  <path d="M188 106c15-6 29-3 39 8-15 7-29 4-39-8Z" fill="#6F7F4E" opacity=".72"/>
</svg>
'@

foreach ($legacyLogo in @('kafgir-logo-primary.svg','kafgir-logo-light.svg','kafgir-logo-dark.svg','kafgir-logo-compact.svg','kafgir-quality-badge.svg')) {
    $legacyPath = Join-Path $brandingRoot $legacyLogo
    if (Test-Path $legacyPath) {
        Remove-Item -LiteralPath $legacyPath
    }
}

Write-Utf8NoBom (Join-Path $brandingRoot 'kafgir-symbol.svg') $symbolSvg
Write-Utf8NoBom (Join-Path $brandingRoot 'kafgir-symbol-light.svg') $symbolLightSvg
Write-Utf8NoBom (Join-Path $brandingRoot 'kafgir-symbol-dark.svg') $symbolDarkSvg
Write-Utf8NoBom (Join-Path $brandingRoot 'kafgir-symbol-small.svg') $symbolSmallSvg
Write-Utf8NoBom (Join-Path $brandingRoot 'kafgir-app-icon.svg') $appIconSvg
Write-Utf8NoBom (Join-Path $brandingRoot 'kafgir-brand-badge.svg') $badgeSvg
Write-Utf8NoBom (Join-Path $brandingRoot 'kafgir-food-placeholder.svg') $foodPlaceholderSvg

foreach ($asset in @('kafgir-symbol.svg','kafgir-symbol-light.svg','kafgir-symbol-dark.svg','kafgir-symbol-small.svg','kafgir-app-icon.svg','kafgir-brand-badge.svg','kafgir-food-placeholder.svg')) {
    Copy-Item -Force (Join-Path $brandingRoot $asset) (Join-Path $frontendBranding $asset)
}
Copy-Item -Force (Join-Path $brandingRoot 'kafgir-app-icon.svg') (Join-Path $frontendPublic 'favicon.svg')

$wpfBrandAssets = @'
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <ResourceDictionary.MergedDictionaries>
        <ResourceDictionary Source="Colors.xaml" />
        <ResourceDictionary Source="Dimensions.xaml" />
        <ResourceDictionary Source="Typography.xaml" />
    </ResourceDictionary.MergedDictionaries>

    <ControlTemplate x:Key="KafgirSymbolTemplate" TargetType="ContentControl">
        <Image Source="pack://application:,,,/Assets/Brand/kafgir-symbol.png"
               Stretch="Uniform"
               FlowDirection="LeftToRight"
               SnapsToDevicePixels="True"
               UseLayoutRounding="True" />
    </ControlTemplate>

    <ControlTemplate x:Key="KafgirSmallSymbolTemplate" TargetType="ContentControl">
        <Image Source="pack://application:,,,/Assets/Brand/kafgir-symbol.png"
               Stretch="Uniform"
               FlowDirection="LeftToRight"
               SnapsToDevicePixels="True"
               UseLayoutRounding="True" />
    </ControlTemplate>

    <ControlTemplate x:Key="KafgirCompactLogoTemplate" TargetType="ContentControl">
        <StackPanel Orientation="Horizontal" FlowDirection="RightToLeft">
            <ContentControl Width="62" Height="72" Template="{StaticResource KafgirSymbolTemplate}" Margin="0,0,4,0" />
            <StackPanel VerticalAlignment="Center">
                <TextBlock Text="&#x06A9;&#x0641;&#x06AF;&#x06CC;&#x0631;" FontFamily="{StaticResource AppFontFamily}" FontSize="36" FontWeight="Bold" Foreground="{StaticResource BrandTerracottaBrush}" />
                <Path Data="M2,2 C44,13 94,11 136,1" Stroke="{StaticResource BrandOliveBrush}" StrokeThickness="3.5" StrokeStartLineCap="Round" StrokeEndLineCap="Round" Stretch="Fill" Height="9" Width="140" />
            </StackPanel>
        </StackPanel>
    </ControlTemplate>

    <ControlTemplate x:Key="KafgirLightLogoTemplate" TargetType="ContentControl">
        <StackPanel Orientation="Horizontal" FlowDirection="RightToLeft">
            <ContentControl Width="58" Height="68" Template="{StaticResource KafgirSymbolTemplate}" Margin="0,0,4,0" />
            <StackPanel VerticalAlignment="Center">
                <TextBlock Text="&#x06A9;&#x0641;&#x06AF;&#x06CC;&#x0631;" FontFamily="{StaticResource AppFontFamily}" FontSize="34" FontWeight="Bold" Foreground="{StaticResource TextOnSecondaryBrush}" />
                <Path Data="M2,2 C42,12 86,10 126,1" Stroke="{StaticResource BrandSaffronBrush}" StrokeThickness="3" StrokeStartLineCap="Round" StrokeEndLineCap="Round" Stretch="Fill" Height="8" Width="130" />
            </StackPanel>
        </StackPanel>
    </ControlTemplate>

    <ControlTemplate x:Key="KafgirHorizontalLogoTemplate" TargetType="ContentControl">
        <StackPanel Orientation="Horizontal" FlowDirection="RightToLeft">
            <ContentControl Width="84" Height="104" Template="{StaticResource KafgirSymbolTemplate}" Margin="0,0,6,0" />
            <StackPanel VerticalAlignment="Center">
                <TextBlock Text="&#x06A9;&#x0641;&#x06AF;&#x06CC;&#x0631;" FontFamily="{StaticResource AppFontFamily}" FontSize="48" FontWeight="Bold" Foreground="{StaticResource BrandTerracottaBrush}" />
                <Path Data="M2,2 C58,16 124,14 184,1" Stroke="{StaticResource BrandOliveBrush}" StrokeThickness="4" StrokeStartLineCap="Round" StrokeEndLineCap="Round" Stretch="Fill" Height="12" Width="190" />
                <TextBlock Text="&#x0622;&#x0634;&#x067E;&#x0632;&#x062E;&#x0627;&#x0646;&#x0647; &#x0622;&#x0646;&#x0644;&#x0627;&#x06CC;&#x0646; &#x063A;&#x0630;&#x0627;&#x06CC; &#x062E;&#x0627;&#x0646;&#x06AF;&#x06CC;" FontFamily="{StaticResource AppFontFamily}" FontSize="14" FontWeight="Medium" Foreground="{StaticResource BrandSecondaryBrush}" Margin="0,3,0,0" />
            </StackPanel>
        </StackPanel>
    </ControlTemplate>
</ResourceDictionary>
'@
Write-Utf8NoBom (Join-Path $wpfThemeDirectory 'BrandAssets.xaml') $wpfBrandAssets

function Add-Leaf([System.Drawing.Graphics]$graphics, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$width, [float]$height, [float]$angle) {
    $state = $graphics.Save()
    $graphics.TranslateTransform($x + ($width / 2), $y + ($height / 2))
    $graphics.RotateTransform($angle)
    $graphics.TranslateTransform(-($x + ($width / 2)), -($y + ($height / 2)))
    $leaf = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $leaf.StartFigure()
    $leaf.AddBezier($x, $y + ($height / 2), $x + ($width * .28), $y - ($height * .18), $x + ($width * .78), $y, $x + $width, $y + ($height / 2))
    $leaf.AddBezier($x + $width, $y + ($height / 2), $x + ($width * .72), $y + ($height * 1.18), $x + ($width * .22), $y + $height, $x, $y + ($height / 2))
    $leaf.CloseFigure()
    $graphics.FillPath($brush, $leaf)
    $graphics.Restore($state)
    $leaf.Dispose()
}

function Draw-KafgirCanonicalSymbol([System.Drawing.Graphics]$graphics, [float]$offsetX, [float]$offsetY, [float]$scale, [bool]$includeDetails) {
    $cream = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#FFF3E2'))
    $charcoal = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#2B2B2B'))
    $wood = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#B8793D'))
    $olive = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#6F7F4E'))
    $saffron = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F2B233'))
    $woodGrainPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(46, 43, 43, 43), 1.5)
    $woodGrainPen.StartCap = $woodGrainPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $olivePen = [System.Drawing.Pen]::new($olive, 2.5)
    $olivePen.StartCap = $olivePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $state = $graphics.Save()
    $graphics.TranslateTransform($offsetX, $offsetY)
    $graphics.ScaleTransform($scale, $scale)
    $graphics.TranslateTransform(50, 56)
    $graphics.RotateTransform(8)
    $graphics.TranslateTransform(-50, -56)

    $head = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $head.StartFigure()
    $head.AddLine(31, 6, 67, 6)
    $head.AddBezier(67, 6, 72, 6, 75, 9.6, 75, 14)
    $head.AddLine(75, 14, 72, 46)
    $head.AddBezier(72, 46, 71, 50.4, 67.4, 54, 63, 54)
    $head.AddLine(63, 54, 35, 54)
    $head.AddBezier(35, 54, 30.6, 54, 27, 50.4, 26, 46)
    $head.AddLine(26, 46, 23, 14)
    $head.AddBezier(23, 14, 23, 9.6, 26.6, 6, 31, 6)
    $head.CloseFigure()
    $graphics.FillPath($charcoal, $head)

    foreach ($slot in @(@(31,16),@(41,16),@(51,16),@(61,16))) {
        $slotPath = New-RoundedPath $slot[0] $slot[1] 4 29 2
        $graphics.FillPath($cream, $slotPath)
        $slotPath.Dispose()
    }

    $neck = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $neck.AddPolygon([System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(42, 53),
        [System.Drawing.PointF]::new(56, 53),
        [System.Drawing.PointF]::new(55, 64),
        [System.Drawing.PointF]::new(43, 64)
    ))
    $graphics.FillPath($charcoal, $neck)

    $handle = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $handle.StartFigure()
    $handle.AddBezier(42, 62, 47, 60.6, 51, 60.6, 56, 62)
    $handle.AddLine(56, 62, 56.5, 98)
    $handle.AddBezier(56.5, 98, 57, 104, 54, 106, 50, 106)
    $handle.AddBezier(50, 106, 46, 105.8, 42.8, 103.2, 42.5, 99)
    $handle.CloseFigure()
    $graphics.FillPath($wood, $handle)

    if ($includeDetails) {
        $graphics.DrawBezier($woodGrainPen, 53, 66, 54, 78, 54, 91, 50, 102)
    }
    $graphics.FillEllipse($cream, 48, 97, 4, 4)
    $graphics.Restore($state)

    if ($includeDetails) {
        $graphics.DrawBezier($olivePen, $offsetX + (55 * $scale), $offsetY + (96 * $scale), $offsetX + (64 * $scale), $offsetY + (96 * $scale), $offsetX + (72 * $scale), $offsetY + (90 * $scale), $offsetX + (79 * $scale), $offsetY + (84 * $scale))
        Add-Leaf $graphics $olive ($offsetX + (62 * $scale)) ($offsetY + (84 * $scale)) (8 * $scale) (5 * $scale) -38
        Add-Leaf $graphics $olive ($offsetX + (70 * $scale)) ($offsetY + (88 * $scale)) (10 * $scale) (5 * $scale) 18
        $graphics.FillEllipse($saffron, $offsetX + (76.8 * $scale), $offsetY + (73.8 * $scale), 4.4 * $scale, 4.4 * $scale)
    }

    foreach ($item in @($cream,$charcoal,$wood,$olive,$saffron,$woodGrainPen,$olivePen,$head,$neck,$handle)) {
        $item.Dispose()
    }
}

function New-KafgirIcon([int]$size) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $scale = $size / 512.0
    $graphics.ScaleTransform($scale, $scale)

    $terracotta = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#E46A4A'))
    $cream = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#FFF3E2'))
    $beigePen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#EADCC0'), 5)

    $background = New-RoundedPath 16 16 480 480 112
    $graphics.FillPath($terracotta, $background)
    $graphics.FillEllipse($cream, 78, 76, 356, 356)
    if ($size -gt 24) {
        $graphics.DrawEllipse($beigePen, 99, 97, 314, 314)
    }

    Draw-KafgirCanonicalSymbol $graphics 91 72 3.15 ($size -gt 24)

    foreach ($item in @($background,$terracotta,$cream,$beigePen)) {
        $item.Dispose()
    }
    $graphics.Dispose()
    return $bitmap
}

function New-KafgirSymbolBitmap {
    $bitmap = [System.Drawing.Bitmap]::new(440, 500, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    Draw-KafgirCanonicalSymbol $graphics 20 24 4.0 $true

    $graphics.Dispose()
    return $bitmap
}

$symbolBitmap = New-KafgirSymbolBitmap
$symbolPngPath = Join-Path $resolvedOutput 'kafgir-symbol-512.png'
$symbolBitmap.Save($symbolPngPath, [System.Drawing.Imaging.ImageFormat]::Png)
Copy-Item -Force $symbolPngPath (Join-Path $wpfBrandDirectory 'kafgir-symbol.png')
$symbolBitmap.Dispose()

$sizes = @(16, 24, 32, 48, 64, 128, 192, 256, 512)
$frames = @()
foreach ($size in $sizes) {
    $bitmap = New-KafgirIcon $size
    $path = Join-Path $resolvedOutput "kafgir-app-icon-$size.png"
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    Copy-Item -Force $path (Join-Path $frontendPublic "kafgir-app-icon-$size.png")
    if ($size -le 256) {
        $stream = [System.IO.MemoryStream]::new()
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $frames += [pscustomobject]@{ Size = $size; Bytes = $stream.ToArray() }
        $stream.Dispose()
    }
    $bitmap.Dispose()
}

$icoPath = Join-Path $resolvedOutput 'kafgir.ico'
$file = [System.IO.File]::Create($icoPath)
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

Copy-Item -Force $icoPath (Join-Path $wpfBrandDirectory 'kafgir.ico')

Write-Output "Generated Kafgir brand assets in $brandingRoot"
