$payload = '{"id":"test-final-001","status":"finished","platform":"android","buildProfile":"preview","appVersion":"1.0.0","gitCommitHash":"abc12345","artifacts":{"applicationArchiveUrl":"https://expo.dev/test.apk"},"createdAt":"2026-04-20T10:00:00Z","completedAt":"2026-04-20T10:08:30Z"}'
$secret = [System.Text.Encoding]::UTF8.GetBytes("doldam-build-secret-2026")
$data   = [System.Text.Encoding]::UTF8.GetBytes($payload)
$hmac   = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = $secret
$sig = "sha256=" + (($hmac.ComputeHash($data) | ForEach-Object { $_.ToString("x2") }) -join "")
Write-Host "Sending test webhook..."
Invoke-RestMethod `
  -Uri "https://doldam-api.scw999.workers.dev/webhooks/eas" `
  -Method POST `
  -ContentType "application/json" `
  -Body $payload `
  -Headers @{"expo-signature" = $sig}
