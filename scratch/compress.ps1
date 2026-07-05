Add-Type -AssemblyName System.Drawing

function Compress-Image($srcPath, $destPath, $newWidth) {
    if (-not (Test-Path $srcPath)) {
        Write-Host "File $srcPath not found"
        return
    }
    $srcImg = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath).Path)
    $ratio = $srcImg.Height / $srcImg.Width
    $newHeight = [int]($newWidth * $ratio)
    
    $destBitmap = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
    $graph = [System.Drawing.Graphics]::FromImage($destBitmap)
    
    # High quality settings
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $graph.DrawImage($srcImg, 0, 0, $newWidth, $newHeight)
    
    # Set JPEG quality to 75
    $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 75)
    
    $destBitmap.Save((Get-Item $destPath -ErrorAction SilentlyContinue).FullName, $encoder, $encoderParams)
    if (-not (Test-Path $destPath)) {
        # Fallback if overwrite fail or new file
        $destBitmap.Save($destPath, $encoder, $encoderParams)
    }
    
    $graph.Dispose()
    $destBitmap.Dispose()
    $srcImg.Dispose()
    
    $oldSize = (Get-Item $srcPath).Length / 1024
    $newSize = (Get-Item $destPath).Length / 1024
    Write-Host "Compressed $srcPath -> $destPath ($($oldSize.ToString('F2')) KB to $($newSize.ToString('F2')) KB)"
}

Compress-Image "src/assets/images/hero-left.jpg" "src/assets/images/hero-left-opt.jpg" 600
Compress-Image "src/assets/images/hero-center.jpg" "src/assets/images/hero-center-opt.jpg" 600
Compress-Image "src/assets/images/hero-right.jpg" "src/assets/images/hero-right-opt.jpg" 600
