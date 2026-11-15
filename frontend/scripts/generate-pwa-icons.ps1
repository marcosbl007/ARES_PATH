Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "..\public\brand\ares-path-logo.png"
$outputDirectory = Join-Path $PSScriptRoot "..\public\brand"
$source = [System.Drawing.Image]::FromFile($sourcePath)

try {
  foreach ($size in @(192, 512)) {
    $bitmap = New-Object System.Drawing.Bitmap(
      $size,
      $size,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

      $padding = [int]($size * 0.08)
      $availableSize = $size - (2 * $padding)
      $scale = [Math]::Min(
        $availableSize / [double]$source.Width,
        $availableSize / [double]$source.Height
      )
      $width = [int]($source.Width * $scale)
      $height = [int]($source.Height * $scale)
      $left = [int](($size - $width) / 2)
      $top = [int](($size - $height) / 2)
      $graphics.DrawImage($source, $left, $top, $width, $height)

      $outputPath = Join-Path $outputDirectory "ares-path-icon-$size.png"
      $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
}
finally {
  $source.Dispose()
}
