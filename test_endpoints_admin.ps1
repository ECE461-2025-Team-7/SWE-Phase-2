# Test script for BASELINE endpoints (Cost, Lineage, License Check)
# Using admin/admin credentials

Write-Host "=== Testing BASELINE Endpoints ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Authenticate
Write-Host "Step 1: Authenticating with admin/admin..." -ForegroundColor Yellow
$authBody = @{
    user = @{
        name = "admin"
    }
    secret = @{
        password = "admin"
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
    Write-Host "✗ Authentication failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""

# Get artifact ID from user
Write-Host "Enter artifact ID to test:" -ForegroundColor Yellow
$artifactId = Read-Host "Artifact ID"

if ([string]::IsNullOrWhiteSpace($artifactId)) {
    Write-Host "No artifact ID provided, exiting." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Test Cost endpoint (standalone)
Write-Host "Step 2: Testing Cost Endpoint (standalone)..." -ForegroundColor Yellow
Write-Host "  GET /artifact/model/$artifactId/cost" -ForegroundColor Gray

try {
    $costStandalone = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/$artifactId/cost" `
        -Method GET `
        -Headers @{"X-Authorization" = "bearer $token"}
    
    Write-Host "✓ Cost (standalone):" -ForegroundColor Green
    $costStandalone | ConvertTo-Json | Write-Host -ForegroundColor White
} catch {
    Write-Host "✗ Cost endpoint failed" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Error: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# Step 3: Test Cost endpoint (with dependencies)
Write-Host "Step 3: Testing Cost Endpoint (with dependencies)..." -ForegroundColor Yellow
Write-Host "  GET /artifact/model/$artifactId/cost?dependency=true" -ForegroundColor Gray

try {
    $costWithDeps = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/$artifactId/cost?dependency=true" `
        -Method GET `
        -Headers @{"X-Authorization" = "bearer $token"}
    
    Write-Host "✓ Cost (with dependencies):" -ForegroundColor Green
    $costWithDeps | ConvertTo-Json | Write-Host -ForegroundColor White
} catch {
    Write-Host "✗ Cost (with deps) endpoint failed" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Error: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
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
    
    Write-Host "`nSummary:" -ForegroundColor Cyan
    Write-Host "  Nodes: $($lineage.nodes.Count)" -ForegroundColor Gray
    Write-Host "  Edges: $($lineage.edges.Count)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Lineage endpoint failed" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Error: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# Step 5: Test License Check endpoint
Write-Host "Step 5: Testing License Check Endpoint..." -ForegroundColor Yellow
Write-Host "  POST /artifact/model/$artifactId/license-check" -ForegroundColor Gray

# Test with MIT license (should be compatible)
$licenseBody1 = @{
    github_url = "https://github.com/huggingface/transformers"
} | ConvertTo-Json

try {
    $licenseCheck1 = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/$artifactId/license-check" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{"X-Authorization" = "bearer $token"} `
        -Body $licenseBody1
    
    Write-Host "✓ License check (MIT - huggingface/transformers): $licenseCheck1" -ForegroundColor Green
} catch {
    Write-Host "✗ License check failed" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Error: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
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
    
    Write-Host "✓ License check (GPL - torvalds/linux): $licenseCheck2" -ForegroundColor Green
} catch {
    Write-Host "✗ License check failed" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Error: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# Step 6: Check history
Write-Host "Step 6: Checking History..." -ForegroundColor Yellow
Write-Host "  GET /artifact/model/$artifactId/history" -ForegroundColor Gray

try {
    $history = Invoke-RestMethod -Uri "http://localhost:3100/artifact/model/$artifactId/history" `
        -Method GET `
        -Headers @{"X-Authorization" = "bearer $token"}
    
    Write-Host "✓ History response received" -ForegroundColor Green
    Write-Host "  Artifact: $($history.artifact.name) ($($history.artifact.type))" -ForegroundColor Gray
    Write-Host "  History entries: $($history.count)" -ForegroundColor Gray
    
    if ($history.history.Count -gt 0) {
        Write-Host "`nHistory entries:" -ForegroundColor Cyan
        $history.history | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor White
    } else {
        Write-Host "  (No history entries found - artifact may have been created before history tracking was added)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ History endpoint failed" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Error: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
