# ============================================================
# 🌌 안티그래비티 미로탈출 - 파워쉘 내장 로컬 웹 서버
# Node.js나 Python 없이 윈도우 기본 기능만으로 작동합니다.
# ============================================================

$port = 8080
$path = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "🚀 안티그래비티 미로탈출 로컬 웹 서버 실행 중!" -ForegroundColor Green
Write-Host "🔗 접속 주소: http://localhost:$port" -ForegroundColor Yellow
Write-Host "💡 서버를 종료하려면 이 창에서 Ctrl + C를 누르세요." -ForegroundColor Gray
Write-Host "=================================================" -ForegroundColor Cyan

Start-Process "http://localhost:$port"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($urlPath)) { $urlPath = "index.html" }
        $filePath = Join-Path $path $urlPath

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                default { "application/octet-stream" }
            }
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.OutputStream.Close()
    } catch {
        # 예외 무시 및 지속 청취
    }
}
