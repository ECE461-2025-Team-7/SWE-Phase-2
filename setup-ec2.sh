#!/bin/bash
# EC2 Setup Script - Run this after deploying code to EC2

set -e  # Exit on error

echo "=========================================="
echo "Setting up Model Registry on EC2"
echo "=========================================="

# Change to app directory
cd /opt/myapp

echo ""
echo "1. Installing Backend Dependencies..."
cd app/backend
npm install
echo "✓ Backend dependencies installed"

echo ""
echo "2. Installing Frontend Dependencies..."
cd ../frontend
npm install
echo "✓ Frontend dependencies installed"

echo ""
echo "3. Verifying Installations..."
cd /opt/myapp

# Check backend
if [ -d "app/backend/node_modules" ]; then
    echo "✓ Backend node_modules exists"
else
    echo "✗ Backend node_modules missing!"
    exit 1
fi

# Check frontend
if [ -d "app/frontend/node_modules" ]; then
    echo "✓ Frontend node_modules exists"
else
    echo "✗ Frontend node_modules missing!"
    exit 1
fi

# Check vite specifically
if [ -d "app/frontend/node_modules/vite" ]; then
    echo "✓ Vite installed"
else
    echo "✗ Vite missing!"
    exit 1
fi

echo ""
echo "4. Checking Environment Configuration..."
if [ -f ".env" ]; then
    echo "✓ .env file exists"
    echo ""
    echo "Current environment variables:"
    grep -E "^(S3_|PORT|ADAPTER_TYPE|MIN_NET_SCORE)" .env || echo "  (none found)"
else
    echo "⚠ Warning: .env file not found!"
    echo "  Creating default .env file..."
    cat > .env << 'EOF'
# AWS Configuration
AWS_REGION=us-east-1

# S3 Storage
S3_BUCKET=hf-model-info
S3_PREFIX=projectA/
S3_AUTH_BUCKET=hf-model-info
S3_AUTH_PREFIX=projectA/auth/

# Server
PORT=3100
ADAPTER_TYPE=s3

# Auth
JWT_EXPIRY=24h

# Rating
MIN_NET_SCORE=0.3

# Logging
LOG_LEVEL=INFO
EOF
    echo "✓ Created default .env file"
fi

echo ""
echo "5. Seeding Default Admin User..."
cd app/backend
node seed-admin.js
echo "✓ Admin user seeded"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Restart PM2 services:"
echo "   pm2 restart all"
echo ""
echo "2. Check logs:"
echo "   pm2 logs"
echo ""
echo "3. Access the application:"
echo "   Frontend: http://$(curl -s http://169.254.169.254/latest/meta-data/public-hostname):3000"
echo "   Backend:  http://$(curl -s http://169.254.169.254/latest/meta-data/public-hostname):3100"
echo ""
