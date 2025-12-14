# ============================================
# Authentication Test Suite for All Protected Endpoints
# Tests that all routes properly validate JWT tokens
# ============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Authentication Endpoint Tests" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Get a valid token first
Write-Host "=== Getting Valid Token ===" -ForegroundColor Green
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
  $validToken = Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $authBody -ContentType "application/json"
  Write-Host "Valid token obtained" -ForegroundColor Green
} catch {
  Write-Host "Failed to get valid token: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Testing Protected Endpoints" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: POST /artifacts - Missing token (403)
Write-Host "=== Test 1: POST /artifacts without token ===" -ForegroundColor Yellow
$body = @(
  @{
    name = "test-model"
  }
) | ConvertTo-Json -Depth 10

try {
  Invoke-RestMethod -Uri "http://localhost:3100/artifacts" -Method POST -Body $body -ContentType "application/json"
  Write-Host "FAIL: Should have returned 403" -ForegroundColor Red
} catch {
  if ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "PASS: Returned 403 for missing token" -ForegroundColor Green
  } else {
    Write-Host "FAIL: Expected 403, got $($_.Exception.Response.StatusCode)" -ForegroundColor Red
  }
}

# Test 2: POST /artifacts - Invalid token (403)
Write-Host "`n=== Test 2: POST /artifacts with invalid token ===" -ForegroundColor Yellow
try {
  Invoke-RestMethod -Uri "http://localhost:3100/artifacts" -Method POST -Body $body -ContentType "application/json" -Headers @{"X-Authorization" = "bearer invalid_token_here"}
  Write-Host "FAIL: Should have returned 403" -ForegroundColor Red
} catch {
  if ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "PASS: Returned 403 for invalid token" -ForegroundColor Green
  } else {
    Write-Host "FAIL: Expected 403, got $($_.Exception.Response.StatusCode)" -ForegroundColor Red
  }
}

# Test 3: POST /artifacts - Valid token (should work)
Write-Host "`n=== Test 3: POST /artifacts with valid token ===" -ForegroundColor Yellow
try {
  $result = Invoke-RestMethod -Uri "http://localhost:3100/artifacts" -Method POST -Body $body -ContentType "application/json" -Headers @{"X-Authorization" = $validToken}
  Write-Host "PASS: Request succeeded with valid token" -ForegroundColor Green
} catch {
  if ($_.Exception.Response.StatusCode -eq 400) {
    Write-Host "PASS: Auth worked, returned 400 for invalid query (expected)" -ForegroundColor Green
  } else {
    Write-Host "Note: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

# Test 4: DELETE /reset - Missing token (403)
Write-Host "`n=== Test 4: DELETE /reset without token ===" -ForegroundColor Yellow
try {
  Invoke-RestMethod -Uri "http://localhost:3100/reset" -Method DELETE
  Write-Host "FAIL: Should have returned 403" -ForegroundColor Red
} catch {
  if ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "PASS: Returned 403 for missing token" -ForegroundColor Green
  } else {
    Write-Host "FAIL: Expected 403, got $($_.Exception.Response.StatusCode)" -ForegroundColor Red
  }
}

# Test 5: DELETE /reset - Invalid token (403)
Write-Host "`n=== Test 5: DELETE /reset with invalid token ===" -ForegroundColor Yellow
try {
  Invoke-RestMethod -Uri "http://localhost:3100/reset" -Method DELETE -Headers @{"X-Authorization" = "bearer bad_token"}
  Write-Host "FAIL: Should have returned 403" -ForegroundColor Red
} catch {
  if ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "PASS: Returned 403 for invalid token" -ForegroundColor Green
  } else {
    Write-Host "FAIL: Expected 403, got $($_.Exception.Response.StatusCode)" -ForegroundColor Red
  }
}

# Test 6: DELETE /reset - Valid token with admin (should work)
Write-Host "`n=== Test 6: DELETE /reset with valid admin token ===" -ForegroundColor Yellow
try {
  $result = Invoke-RestMethod -Uri "http://localhost:3100/reset" -Method DELETE -Headers @{"X-Authorization" = $validToken}
  Write-Host "PASS: Reset succeeded with valid admin token" -ForegroundColor Green
} catch {
  Write-Host "Note: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Test 7: POST /artifact/model - Missing token (403)
Write-Host "`n=== Test 7: POST /artifact/model without token ===" -ForegroundColor Yellow
$artifactBody = @{
  url = "https://huggingface.co/test/model"
} | ConvertTo-Json -Depth 10

try {
  Invoke-RestMethod -Uri "http://localhost:3100/artifact/model" -Method POST -Body $artifactBody -ContentType "application/json"
  Write-Host "FAIL: Should have returned 403" -ForegroundColor Red
} catch {
  if ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "PASS: Returned 403 for missing token" -ForegroundColor Green
  } else {
    Write-Host "FAIL: Expected 403, got $($_.Exception.Response.StatusCode)" -ForegroundColor Red
  }
}

# Test 8: POST /artifact/model - Valid token (should work or return expected error)
Write-Host "`n=== Test 8: POST /artifact/model with valid token ===" -ForegroundColor Yellow
try {
  $result = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model" -Method POST -Body $artifactBody -ContentType "application/json" -Headers @{"X-Authorization" = $validToken}
  Write-Host "PASS: Request succeeded with valid token" -ForegroundColor Green
} catch {
  if ($_.Exception.Response.StatusCode -ne 403) {
    Write-Host "PASS: Auth worked (got non-403 error)" -ForegroundColor Green
  } else {
    Write-Host "FAIL: Still getting 403 with valid token" -ForegroundColor Red
  }
}

# Test 9: GET /artifacts/model/:id - Missing token (403)
Write-Host "`n=== Test 9: GET /artifacts/model/123 without token ===" -ForegroundColor Yellow
try {
  Invoke-RestMethod -Uri "http://localhost:3100/artifacts/model/123" -Method GET
  Write-Host "FAIL: Should have returned 403" -ForegroundColor Red
} catch {
  if ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "PASS: Returned 403 for missing token" -ForegroundColor Green
  } else {
    Write-Host "FAIL: Expected 403, got $($_.Exception.Response.StatusCode)" -ForegroundColor Red
  }
}

# Test 10: GET /artifacts/model/:id - Valid token (should work or return 404)
Write-Host "`n=== Test 10: GET /artifacts/model/123 with valid token ===" -ForegroundColor Yellow
try {
  $result = Invoke-RestMethod -Uri "http://localhost:3100/artifacts/model/123" -Method GET -Headers @{"X-Authorization" = $validToken}
  Write-Host "PASS: Request succeeded with valid token" -ForegroundColor Green
} catch {
  if ($_.Exception.Response.StatusCode -eq 404) {
    Write-Host "PASS: Auth worked, returned 404 (artifact not found)" -ForegroundColor Green
  } elseif ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "FAIL: Still getting 403 with valid token" -ForegroundColor Red
  } else {
    Write-Host "Note: Got status $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
  }
}

# Test 11: GET /artifact/model/:id/rate - Missing token (403)
Write-Host "`n=== Test 11: GET /artifact/model/123/rate without token ===" -ForegroundColor Yellow
try {
  Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/123/rate" -Method GET
  Write-Host "FAIL: Should have returned 403" -ForegroundColor Red
} catch {
  if ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "PASS: Returned 403 for missing token" -ForegroundColor Green
  } else {
    Write-Host "FAIL: Expected 403, got $($_.Exception.Response.StatusCode)" -ForegroundColor Red
  }
}

# Test 12: GET /artifact/model/:id/rate - Valid token
Write-Host "`n=== Test 12: GET /artifact/model/123/rate with valid token ===" -ForegroundColor Yellow
try {
  $result = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/123/rate" -Method GET -Headers @{"X-Authorization" = $validToken}
  Write-Host "PASS: Request succeeded with valid token" -ForegroundColor Green
} catch {
  if ($_.Exception.Response.StatusCode -ne 403) {
    Write-Host "PASS: Auth worked (got non-403 error)" -ForegroundColor Green
  } else {
    Write-Host "FAIL: Still getting 403 with valid token" -ForegroundColor Red
  }
}

# Test 13: GET /tracks - Should work WITHOUT token (not protected)
Write-Host "`n=== Test 13: GET /tracks without token (should work) ===" -ForegroundColor Yellow
try {
  $result = Invoke-RestMethod -Uri "http://localhost:3100/tracks" -Method GET
  Write-Host "PASS: /tracks works without authentication" -ForegroundColor Green
  Write-Host "  Tracks: $($result.plannedTracks -join ', ')" -ForegroundColor Gray
} catch {
  Write-Host "FAIL: /tracks should not require authentication" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "All Authentication Tests Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
