#!/bin/bash
# Test script to validate AWS deployment functionality
# Usage: ./test-aws-deployment.sh <BASE_URL>
# Example: ./test-aws-deployment.sh http://ec2-52-23-202-149.compute-1.amazonaws.com:3000

BASE_URL="${1:-http://ec2-52-23-202-149.compute-1.amazonaws.com:3000}"

echo "Testing deployment at: $BASE_URL"
echo "================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "\n${YELLOW}Test 1: Health Check${NC}"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed (HTTP $HEALTH)${NC}"
    exit 1
fi

# Test 2: Tracks Endpoint
echo -e "\n${YELLOW}Test 2: Tracks Endpoint${NC}"
TRACKS=$(curl -s "$BASE_URL/tracks")
echo "Response: $TRACKS"
if [[ $TRACKS == *"Access control track"* ]]; then
    echo -e "${GREEN}✓ Tracks endpoint working${NC}"
else
    echo -e "${RED}✗ Tracks endpoint failed${NC}"
fi

# Test 3: Authenticate
echo -e "\n${YELLOW}Test 3: Authentication${NC}"
AUTH_RESPONSE=$(curl -s -X PUT "$BASE_URL/authenticate" \
  -H "Content-Type: application/json" \
  -d '{"user": {"name": "ece30861defaultadminuser", "is_admin": true}, "secret": {"password": "correcthorsebatterystaple123(!)"}}')

TOKEN=$(echo "$AUTH_RESPONSE" | tr -d '"' | sed 's/bearer //')
if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ Authentication failed${NC}"
    echo "Response: $AUTH_RESPONSE"
    exit 1
else
    echo -e "${GREEN}✓ Authentication successful${NC}"
    echo "Token: ${TOKEN:0:50}..."
fi

# Test 4: Query all artifacts before reset
echo -e "\n${YELLOW}Test 4: Query Artifacts Before Reset${NC}"
ARTIFACTS_BEFORE=$(curl -s -X POST "$BASE_URL/artifacts" \
  -H "Content-Type: application/json" \
  -H "X-Authorization: bearer $TOKEN" \
  -d '[{"name": "*"}]')
ARTIFACT_COUNT_BEFORE=$(echo "$ARTIFACTS_BEFORE" | grep -o '"id"' | wc -l)
echo "Artifacts found: $ARTIFACT_COUNT_BEFORE"
if [ "$ARTIFACT_COUNT_BEFORE" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $ARTIFACT_COUNT_BEFORE artifacts before reset${NC}"
fi

# Test 5: Reset Registry
echo -e "\n${YELLOW}Test 5: Reset Registry${NC}"
RESET_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/reset" \
  -H "X-Authorization: bearer $TOKEN")
if [ "$RESET_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Reset successful${NC}"
else
    echo -e "${RED}✗ Reset failed (HTTP $RESET_RESPONSE)${NC}"
fi

# Wait a moment for reset to complete
sleep 2

# Test 6: Verify artifacts cleared
echo -e "\n${YELLOW}Test 6: Verify No Artifacts After Reset${NC}"
ARTIFACTS_AFTER=$(curl -s -X POST "$BASE_URL/artifacts" \
  -H "Content-Type: application/json" \
  -H "X-Authorization: bearer $TOKEN" \
  -d '[{"name": "*"}]')
ARTIFACT_COUNT_AFTER=$(echo "$ARTIFACTS_AFTER" | grep -o '"id"' | wc -l)
echo "Artifacts found: $ARTIFACT_COUNT_AFTER"
if [ "$ARTIFACT_COUNT_AFTER" -eq 0 ]; then
    echo -e "${GREEN}✓ All artifacts cleared after reset${NC}"
else
    echo -e "${RED}✗ CRITICAL: Found $ARTIFACT_COUNT_AFTER artifacts after reset!${NC}"
    echo "This is the main issue causing autograder failures."
    echo "Response: $ARTIFACTS_AFTER"
fi

# Test 7: Re-authenticate after reset (token should be invalid)
echo -e "\n${YELLOW}Test 7: Verify Token Invalidated After Reset${NC}"
TEST_QUERY=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/artifacts" \
  -H "Content-Type: application/json" \
  -H "X-Authorization: bearer $TOKEN" \
  -d '[{"name": "*"}]')
if [ "$TEST_QUERY" = "403" ]; then
    echo -e "${GREEN}✓ Old token correctly invalidated${NC}"
else
    echo -e "${YELLOW}⚠ Token still valid or other error (HTTP $TEST_QUERY)${NC}"
fi

# Summary
echo -e "\n${YELLOW}================================${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}================================${NC}"
if [ "$ARTIFACT_COUNT_AFTER" -eq 0 ]; then
    echo -e "${GREEN}✓ Reset functionality working correctly!${NC}"
else
    echo -e "${RED}✗ Reset functionality FAILED - artifacts not cleared${NC}"
fi
