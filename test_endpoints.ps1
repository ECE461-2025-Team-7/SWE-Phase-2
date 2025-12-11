# Test script for BASELINE endpoints (Cost, Lineage, License Check)
# PowerShell version for Windows

Write-Host "=== Testing BASELINE Endpoints ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Authenticate
Write-Host "Step 1: Authenticating..." -ForegroundColor Yellow
$authBody = @{
    user = @{
        name = "ece30861defaultadminuser"
    }
    secret = @{
        password = "correcthorsebatterystaple123(!"
    }
} | ConvertTo-Json

try {
    $authResponse = Invoke-RestMethod -Uri "http://localhost:3100/authenticate" `
        -Method PUT `
        -ContentType "application/json" `
        -Body $authBody
    
    $token = $authResponse.Replace("bearer ", "")
    Write-Host "✓ Authentication successful" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "✗ Authentication failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Create a test model (or use existing)
Write-Host "Step 2: Creating test artifact..." -ForegroundColor Yellow
$createBody = @{
    url = "https://huggingface.co/bert-base-uncased"
} | ConvertTo-Json

try {
    $artifact = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{"X-Authorization" = "bearer $token"} `
        -Body $createBody
    
    $artifactId = $artifact.metadata.id
    $artifactName = $artifact.metadata.name
    Write-Host "✓ Created artifact: $artifactName" -ForegroundColor Green
    Write-Host "  ID: $artifactId" -ForegroundColor Gray
} catch {
    Write-Host "Note: Could not create new artifact (may already exist)" -ForegroundColor Yellow
    Write-Host "Please enter an existing artifact ID to test with:" -ForegroundColor Yellow
    $artifactId = Read-Host "Artifact ID"
}

Write-Host ""

# Step 3: Test Cost endpoint
Write-Host "Step 3: Testing Cost Endpoint..." -ForegroundColor Yellow
Write-Host "  GET /artifact/model/$artifactId/cost" -ForegroundColor Gray

try {
    $costStandalone = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/$artifactId/cost" `
        -Method GET `
        -Headers @{"X-Authorization" = "bearer $token"}
    
    Write-Host "✓ Cost (standalone):" -ForegroundColor Green
    $costStandalone | ConvertTo-Json | Write-Host -ForegroundColor White
} catch {
    Write-Host "✗ Cost endpoint failed: $_" -ForegroundColor Red
}

Write-Host ""

try {
    $costWithDeps = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/$artifactId/cost?dependency=true" `
        -Method GET `
        -Headers @{"X-Authorization" = "bearer $token"}
    
    Write-Host "✓ Cost (with dependencies):" -ForegroundColor Green
    $costWithDeps | ConvertTo-Json | Write-Host -ForegroundColor White
} catch {
    Write-Host "✗ Cost (with deps) endpoint failed: $_" -ForegroundColor Red
}

Write-Host ""

# Step 4: Test Lineage endpoint
Write-Host "Step 4: Testing Lineage Endpoint..." -ForegroundColor Yellow
Write-Host "  GET /artifact/model/$artifactId/lineage" -ForegroundColor Gray

try {
    $lineage = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/$artifactId/lineage" `
        -Method GET `
        -Headers @{"X-Authorization" = "bearer $token"}
    
    Write-Host "✓ Lineage graph:" -ForegroundColor Green
    $lineage | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor White
} catch {
    Write-Host "✗ Lineage endpoint failed: $_" -ForegroundColor Red
}

Write-Host ""

# Step 5: Test License Check endpoint
Write-Host "Step 5: Testing License Check Endpoint..." -ForegroundColor Yellow
Write-Host "  POST /artifact/model/$artifactId/license-check" -ForegroundColor Gray

# Test with MIT license (should pass)
$licenseBody1 = @{
    github_url = "https://github.com/huggingface/transformers"
} | ConvertTo-Json

try {
    $licenseCheck1 = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/$artifactId/license-check" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{"X-Authorization" = "bearer $token"} `
        -Body $licenseBody1
    
    Write-Host "✓ License check (MIT - transformers): $licenseCheck1" -ForegroundColor Green
} catch {
    Write-Host "✗ License check failed: $_" -ForegroundColor Red
}

Write-Host ""

# Test with GPL license
$licenseBody2 = @{
    github_url = "https://github.com/torvalds/linux"
} | ConvertTo-Json

try {
    $licenseCheck2 = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/$artifactId/license-check" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{"X-Authorization" = "bearer $token"} `
        -Body $licenseBody2
    
    Write-Host "✓ License check (GPL - linux): $licenseCheck2" -ForegroundColor Green
} catch {
    Write-Host "✗ License check failed: $_" -ForegroundColor Red
}

Write-Host ""

# Step 6: Check history
Write-Host "Step 6: Checking History (should show ARTIFACT_CREATED)..." -ForegroundColor Yellow
Write-Host "  GET /artifact/model/$artifactId/history" -ForegroundColor Gray

try {
    $history = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/$artifactId/history" `
        -Method GET `
        -Headers @{"X-Authorization" = "bearer $token"}
    
    Write-Host "✓ History entries: $($history.count)" -ForegroundColor Green
    if ($history.history.Count -gt 0) {
        $history.history | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor White
    } else {
        Write-Host "  (No history entries found)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ History endpoint failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
