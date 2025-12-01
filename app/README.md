# Artifact Registry

A full-stack artifact registry application with JWT-based authentication and AWS S3 storage.

## Project Structure

```
app/
├── backend/           # Node.js/Express backend API
│   ├── src/          # Backend source code
│   ├── docs/         # Backend documentation
│   ├── .env          # Environment variables
│   └── package.json  # Backend dependencies
└── frontend/         # React frontend UI
    ├── src/          # Frontend source code
    └── package.json  # Frontend dependencies
```

## Prerequisites

- Node.js (v16 or higher)
- AWS Account with S3 access (or use local adapter for development)
- npm or yarn

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install

# Configure environment variables
# Edit .env file with your AWS credentials or use STORAGE_ADAPTER=local

# Seed the default admin user
node seed-admin.js

# Start the backend server
npm start
```

The backend will run on `http://localhost:3100`

### 2. Frontend Setup

```bash
cd frontend
npm install

# Start the development server
npm run dev
```

The frontend will run on `http://localhost:3000`

## Default Admin Credentials

- **Username**: `ece30861defaultadminuser`
- **Password**: `correcthorsebatterystaple123(!__+@**(A'"`;DROP TABLE artifacts;`
- **Admin**: `true`

## Documentation

- [Backend Authentication Setup](backend/docs/AUTHENTICATION_SETUP.md)
- [Authentication Quick Reference](backend/docs/AUTH_QUICK_REFERENCE.md)
- [Testing Authentication](backend/docs/test-authenticate.md)

## Environment Variables

### Backend (.env)
```env
# Server Configuration
PORT=3100

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=24h

# Storage Configuration
STORAGE_ADAPTER=local  # or 's3' for AWS S3
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket-name
```

## Development

### Backend
```bash
cd backend
npm run dev  # Start with nodemon for auto-reload
```

### Frontend
```bash
cd frontend
npm run dev  # Start Vite dev server
```

## Building for Production

### Backend
The backend runs directly with Node.js - no build step required.

### Frontend
```bash
cd frontend
npm run build  # Creates optimized production build in dist/
```

## Features

- 🔐 JWT-based authentication
- 👤 User management with admin roles
- 📦 Artifact storage (S3 or local filesystem)
- 🚀 RESTful API
- ⚛️ Modern React UI
- 🔄 Rate limiting and health checks

## API Endpoints

- `PUT /authenticate` - Get JWT token
- `GET /health` - Health check
- `POST /artifact` - Upload artifact
- `GET /artifact/:id` - Get artifact
- `DELETE /reset` - Reset registry (admin only)
- And more...

## License

MIT
