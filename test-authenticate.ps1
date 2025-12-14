# ============================================
# PowerShell Authentication Test Suite
# ============================================

Write-Host "`n=== Test 1: Successful Authentication ===" -ForegroundColor Cyan
$password = "correcthorsebatterystaple123(!__+@**(A'" + '"`' + "`;DROP TABLE artifacts;"
$body = @{
  user = @{
    name = "ece30861defaultadminuser"
    is_admin = $true
  }
  secret = @{
    password = $password
  }
} | ConvertTo-Json -Depth 10

try {
  $token = Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
  Write-Host "Success! Token received" -ForegroundColor Green
  Write-Host "  Token: $token" -ForegroundColor Gray
} catch {
  Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Test 2: Invalid Username ===" -ForegroundColor Cyan
$body = @{
  user = @{
    name = "wronguser"
    is_admin = $true
  }
  secret = @{
    password = $password
  }
} | ConvertTo-Json -Depth 10

try {
  Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
  Write-Host "Should have failed!" -ForegroundColor Red
} catch {
  Write-Host "Expected 401 error" -ForegroundColor Green
}

Write-Host "`n=== Test 3: Invalid Password ===" -ForegroundColor Cyan
$body = @{
  user = @{
    name = "ece30861defaultadminuser"
    is_admin = $true
  }
  secret = @{
    password = "wrongpassword"
  }
} | ConvertTo-Json -Depth 10

try {
  Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
  Write-Host "Should have failed!" -ForegroundColor Red
} catch {
  Write-Host "Expected 401 error" -ForegroundColor Green
}

Write-Host "`n=== Test 4: Missing Password Field ===" -ForegroundColor Cyan
$body = @{
  user = @{
    name = "ece30861defaultadminuser"
    is_admin = $true
  }
  secret = @{}
} | ConvertTo-Json -Depth 10

try {
  Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
  Write-Host "Should have failed!" -ForegroundColor Red
} catch {
  Write-Host "Expected 400 error" -ForegroundColor Green
}

Write-Host "`n=== Test 5: Missing User Name ===" -ForegroundColor Cyan
$body = @{
  user = @{
    is_admin = $true
  }
  secret = @{
    password = $password
  }
} | ConvertTo-Json -Depth 10

try {
  Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
  Write-Host "Should have failed!" -ForegroundColor Red
} catch {
  Write-Host "Expected 400 error" -ForegroundColor Green
}

Write-Host "`n=== Test 6: Missing Secret Object ===" -ForegroundColor Cyan
$body = @{
  user = @{
    name = "ece30861defaultadminuser"
    is_admin = $true
  }
} | ConvertTo-Json -Depth 10

try {
  Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
  Write-Host "Should have failed!" -ForegroundColor Red
} catch {
  Write-Host "Expected 400 error" -ForegroundColor Green
}

Write-Host "`n=== Test 7: Wrong is_admin Value ===" -ForegroundColor Cyan
$body = @{
  user = @{
    name = "ece30861defaultadminuser"
    is_admin = $false
  }
  secret = @{
    password = $password
  }
} | ConvertTo-Json -Depth 10

try {
  Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
  Write-Host "Should have failed!" -ForegroundColor Red
} catch {
  Write-Host "Expected 401 error" -ForegroundColor Green
}

Write-Host "`n=== Test 8: Empty Request Body ===" -ForegroundColor Cyan
$body = "{}"

try {
  Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
  Write-Host "Should have failed!" -ForegroundColor Red
} catch {
  Write-Host "Expected 400 error" -ForegroundColor Green
}

Write-Host "`n=== Test 9: Using Token on Protected Endpoint ===" -ForegroundColor Cyan
$password = "correcthorsebatterystaple123(!__+@**(A'" + '"`' + "`;DROP TABLE artifacts;"
$authBody = @{
  user = @{
    name = "ece30861defaultadminuser"
    is_admin = $true
  }
  secret = @{
    password = $password
  }
} | ConvertTo-Json -Depth 10

try {
  $token = Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $authBody -ContentType "application/json"
  Write-Host "Token obtained" -ForegroundColor Green
  
  try {
    $result = Invoke-RestMethod -Uri "http://localhost:3100/artifacts" -Method GET -Headers @{"X-Authorization" = $token}
    Write-Host "Token works on protected endpoint" -ForegroundColor Green
  } catch {
    Write-Host "  Note: Artifacts endpoint test - $($_.Exception.Message)" -ForegroundColor Yellow
  }
} catch {
  Write-Host "Failed to get token: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "All tests complete!" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan
