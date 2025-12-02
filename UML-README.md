# Phase 2: Trustworthy Model Registry - UML Documentation

## Overview

This document explains the UML diagram (`Phase2-UML.puml`) for the Phase 2 implementation of the Trustworthy Model Registry project. The system is a hybrid architecture combining **Node.js/Express** for the REST API layer with **Python** for the core metric calculation engine.

## How to View the UML Diagram

The UML diagram is in PlantUML format (`.puml` file). To view it:

1. **Online**: Copy the contents of `Phase2-UML.puml` to [PlantUML Online Editor](http://www.plantuml.com/plantuml/)
2. **VS Code**: Install the "PlantUML" extension and preview the file
3. **Command Line**: Install PlantUML and run `plantuml Phase2-UML.puml` to generate an image

## Architecture Overview

The system follows a **layered architecture** with clear separation of concerns:

### Layer 1: REST API (Node.js/Express)
- **Routes**: Handle HTTP requests and responses
- **Middleware**: Authentication, validation, error handling
- **Pipelines**: Business logic orchestration

### Layer 2: Storage Adapters (Node.js)
- **S3Adapter**: Production storage using AWS S3
- **localAdapter**: Development/testing with in-memory storage
- **S3AuthAdapter**: Authentication data storage

### Layer 3: Python Core Engine
- **URL Processor**: Main orchestrator for metric calculation
- **Metric Calculators**: 11+ specialized calculators for model evaluation
- **Support Modules**: Git analysis, LLM integration, HTTP clients

### Layer 4: External Services
- **AWS S3**: Cloud storage for artifacts and authentication data
- **GitHub/HuggingFace APIs**: External data sources

## Key Components

### Express Server Components

#### Routes (API Endpoints)

| Route | HTTP Method | Purpose |
|-------|-------------|---------|
| `/authenticate` | PUT | User authentication, returns JWT token |
| `/artifact/:type` | POST | Upload new artifact (model/dataset/code) |
| `/artifacts/:type/:id` | GET, PUT | Retrieve or update artifact |
| `/artifact/model/:id/rate` | GET | Get rating scores for a model |
| `/health` | GET | System health check |
| `/tracks` | GET | Get planned implementation tracks |
| `/reset` | DELETE | Reset registry (auth required) |

#### Middleware

- **authMiddleware**: JWT token verification, tracks token usage (1000 use limit per spec)
- **http-helpers**: Validation middleware for request parameters and bodies

#### Pipelines

1. **DataPipeline**: Abstraction layer for artifact CRUD operations
   - Delegates to either S3Adapter or localAdapter based on `ADAPTER` env var
   - Ensures consistent interface regardless of storage backend

2. **RunPipeline**: Bridge between Node.js and Python
   - Spawns Python subprocess to execute `src/web_utils.py`
   - Parses JSON output from Python metrics engine
   - Handles timeouts and error conditions

### Storage Adapters

#### S3Adapter (Production)
- Stores artifacts as JSON files in S3: `{type}/{id}.json`
- Implements duplicate URL detection by scanning all existing artifacts
- Uses AWS SDK v3 for S3 operations
- Configurable via environment variables: `S3_BUCKET`, `S3_PREFIX`, `AWS_REGION`

#### localAdapter (Development)
- In-memory storage using JavaScript `Map`
- Same interface as S3Adapter for easy switching
- No persistence - data lost on server restart

#### S3AuthAdapter (Authentication)
- Manages three types of S3 objects:
  - `users/{username}.json`: User credentials (bcrypt hashed passwords)
  - `tokens/{hash}.json`: Active JWT tokens with usage tracking
  - `audit/{user}/{timestamp}.json`: Authentication audit logs
- Implements token expiration (10 hours per spec)
- Tracks token usage count (1000 API call limit per spec)

### Python Core Engine

#### URLProcessor
The main orchestrator that:
1. Takes a model/dataset/code URL as input
2. Creates a `ModelContext` with metadata from HuggingFace/GitHub APIs
3. Instantiates 11 metric calculators
4. Executes all calculators (some in parallel via ThreadPoolExecutor)
5. Computes weighted net score
6. Returns `ModelResult` with all scores and latencies

#### Metric Calculators (11 Total)

All inherit from abstract `MetricCalculator` base class:

| Metric | Purpose | Key Methods |
|--------|---------|-------------|
| **BusFactorCalculator** | Measures contributor diversity | Analyzes Git commit history |
| **CodeQualityCalculator** | Evaluates code structure | Checks documentation, test coverage |
| **DatasetCodeCalculator** | Validates dataset/code links | Verifies URLs are accessible |
| **DatasetQualityCalculator** | Assesses dataset documentation | Checks format, metadata |
| **LicenseCalculator** | Checks license compatibility | Detects license type, validates |
| **PerformanceClaimsCalculator** | Verifies model performance claims | Uses LLM to extract/verify claims |
| **RampUpCalculator** | Measures ease of getting started | Assesses documentation, examples |
| **ReproducibilityCalculator** | Tests if model can be reproduced | Attempts to run demo code |
| **ReviewednessCalculator** | Measures code review coverage | Analyzes PRs for review ratio |
| **SizeCalculator** | Evaluates model size | Scores for different platforms |
| **TreeScoreCalculator** | Scores based on parent models | Recursive parent model evaluation |

Each calculator:
- Takes a `ModelContext` as input
- Returns a score between 0.0 and 1.0
- Tracks calculation time in milliseconds
- Handles errors gracefully with default scores

#### Support Modules

- **GitAnalyzer**: Clones repos, analyzes contributors, code review ratios
- **ModelDynamicAnalyzer**: Loads HuggingFace models, extracts metadata
- **LLMClient**: Interface to LLM API for analyzing model cards
- **http_client**: Rate-limited HTTP requests to GitHub/HuggingFace APIs
- **RateLimiter**: Prevents API rate limit violations
- **Config**: Centralized configuration management

#### Storage Classes

- **ResultsStorage**: In-memory storage of metric results during processing
- **MetricResult**: Individual metric score with timestamp
- **ModelResult**: Complete result package with all 11+ metrics and net score

### Data Flow

#### Artifact Upload Flow
```
1. Client -> POST /artifact/model
2. artifactRouter receives request
3. authMiddleware validates JWT token
4. artifactRouter calls score_validate()
5. score_validate spawns Python subprocess
6. Python: web_utils.rate_url() -> URLProcessor -> All Metrics
7. Python returns JSON with net_score
8. artifactRouter checks net_score >= threshold (default 0.5)
9. If pass: DataPipeline.createArtifact()
10. DataPipeline -> S3Adapter -> AWS S3
11. Return 201 Created with artifact JSON
```

#### Model Rating Flow
```
1. Client -> GET /artifact/model/{id}/rate
2. rateRouter receives request
3. authMiddleware validates JWT token
4. RunPipeline.executeRun({id})
5. DataPipeline.getArtifact() to fetch URL
6. RunPipeline spawns Python subprocess
7. Python: web_utils.rate_url() -> Full metric calculation
8. Return 200 OK with complete rating JSON
```

#### Authentication Flow
```
1. Client -> PUT /authenticate with {user, secret}
2. authenticateRouter validates request structure
3. S3AuthAdapter.getUser(username)
4. bcrypt.compare(password, stored_hash)
5. jwt.sign() creates token
6. S3AuthAdapter.storeToken() saves to S3
7. S3AuthAdapter.logAuthEvent() for audit
8. Return 200 OK with "bearer {token}"
```

## Design Patterns Used

### 1. **Adapter Pattern**
- `StorageAdapter` interface with `S3Adapter` and `localAdapter` implementations
- Allows swapping storage backends without changing business logic

### 2. **Strategy Pattern**
- Multiple metric calculators implementing `MetricCalculator` interface
- URLProcessor selects and executes appropriate calculators

### 3. **Pipeline Pattern**
- `DataPipeline` and `RunPipeline` orchestrate multi-step operations
- Clear separation between routing, validation, and business logic

### 4. **Factory Pattern**
- URLProcessor creates metric calculator instances dynamically
- Adapter selection based on environment configuration

### 5. **Repository Pattern**
- Storage adapters abstract data persistence details
- Business logic unaware of S3 vs local storage

### 6. **Facade Pattern**
- `web_utils.py` provides simple `rate_url()` interface
- Hides complexity of URLProcessor and metric calculations

## Key Design Decisions

### Hybrid Architecture (Node.js + Python)
**Why?**
- **Node.js**: Excellent for REST APIs, async I/O, AWS SDK
- **Python**: Rich ML/data science ecosystem, existing Phase 1 code
- **Bridge**: Child process spawning allows language interop

**Trade-offs**:
- ✅ Leverage strengths of both ecosystems
- ✅ Reuse Phase 1 Python metrics without rewriting
- ❌ IPC overhead for Python subprocess calls
- ❌ More complex deployment (two runtimes)

### Storage Adapter Pattern
**Why?**
- Support both S3 (production) and local (development/testing)
- Easy to add new storage backends (DynamoDB, MongoDB, etc.)

### Token Usage Tracking in S3
**Why?**
- Project spec requires 1000 API call limit per token
- S3 provides durable storage for token state
- Alternative (in-memory) would lose state on server restart

**Trade-offs**:
- ✅ Survives server restarts
- ✅ Can scale to multiple server instances
- ❌ Extra S3 call on every authenticated request
- ❌ Potential race conditions with concurrent requests

### Metric Calculation Architecture
**Why separate Python process?**
- Reuse Phase 1 code without rewriting in JavaScript
- Python better for ML/data science libraries
- Isolation: Python crashes don't crash Node server

**Alternative considered**: Embed Python in Node via `node-python-bridge`
- Rejected due to complexity and potential memory issues

## AWS S3 Storage Structure

```
S3_BUCKET/
├── {S3_PREFIX}/              # Artifact storage (default: "")
│   ├── model/
│   │   ├── {uuid1}.json
│   │   ├── {uuid2}.json
│   │   └── ...
│   ├── dataset/
│   │   └── {uuid}.json
│   └── code/
│       └── {uuid}.json
│
└── {S3_AUTH_PREFIX}/         # Auth storage (default: "auth/")
    ├── users/
    │   ├── ece30861defaultadminuser.json
    │   └── {username}.json
    ├── tokens/
    │   └── {token_hash}.json
    └── audit/
        └── {username}/
            └── {timestamp}-{action}.json
```

## Authentication & Security

### JWT Tokens
- Signed with `JWT_SECRET` (configurable via env var)
- Expiry: 10 hours (per project spec)
- Format: `bearer {token}`
- Usage tracked: max 1000 API calls per token

### Password Storage
- Hashed with bcrypt (salt rounds: 10)
- Never stored or transmitted in plaintext
- Validated on authentication

### Audit Trail
- Every auth event logged to S3
- Includes: login, failed_login, logout
- Metadata: timestamp, reason, IP (if available)

### Authorization Levels
- **Regular User**: Can upload, search, download artifacts
- **Admin User**: Can also register new users
- Enforced via `is_admin` flag in JWT payload

## Testing Considerations

The architecture supports multiple testing levels:

### Unit Tests
- **Node.js**: Routes, middleware, adapters
- **Python**: Individual metric calculators

### Integration Tests
- DataPipeline with localAdapter (no AWS needed)
- RunPipeline with mock Python responses

### End-to-End Tests
- Full flow: API -> Pipeline -> Python -> Storage
- Use localAdapter to avoid S3 costs/complexity

### Production Smoke Tests
- Use S3Adapter with dedicated test bucket
- Validate AWS integration works

## Environment Configuration

Key environment variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Express server port | 3100 |
| `ADAPTER` | Storage adapter (s3/local) | s3 |
| `S3_BUCKET` | AWS S3 bucket name | (required) |
| `S3_PREFIX` | Artifact prefix in bucket | "" |
| `S3_AUTH_BUCKET` | Auth data bucket | S3_BUCKET |
| `S3_AUTH_PREFIX` | Auth data prefix | "auth/" |
| `AWS_REGION` | AWS region | us-east-1 |
| `JWT_SECRET` | JWT signing secret | (change in prod!) |
| `JWT_EXPIRY` | Token expiration | 10h |
| `GITHUB_TOKEN` | GitHub API token | (optional) |
| `MIN_NET_SCORE` | Min score for ingestion | 0.5 |

## Scalability Considerations

### Horizontal Scaling
- ✅ Stateless Express servers (JWT, not sessions)
- ✅ S3 handles concurrent access
- ⚠️ Token usage tracking may have race conditions
  - Could use DynamoDB with atomic counters instead

### Performance Optimizations
- Python metrics calculated in parallel (ThreadPoolExecutor)
- HTTP requests are rate-limited but concurrent
- S3 duplicate checking is expensive (O(n) scan)
  - Could add DynamoDB index for better performance

### Cost Optimization
- Use local adapter for development
- S3 storage is cheap (~$0.023/GB/month)
- API costs: S3 GET/PUT requests (~$0.0004/1000 requests)
- Consider S3 lifecycle policies to archive old artifacts

## Future Enhancements (Not Yet Implemented)

Based on the project spec, potential additions:

1. **Web UI**: Pleasant browser interface for artifact management
2. **Artifact Search**: Regex search over names/descriptions
3. **Version Ranges**: Support "~1.2.0" and "^1.2.0" notation
4. **Lineage Graph**: Visualize parent model relationships
5. **License Compatibility**: Check GitHub license vs Model license
6. **Partial Downloads**: Download just weights or datasets
7. **Model Ingest**: Automatic HuggingFace model ingestion
8. **Health Dashboard**: Real-time system metrics visualization
9. **Pagination**: For large artifact listings
10. **Tracks**: Performance, Security, or High-Assurance specialization

## Troubleshooting

### Common Issues

**Issue**: Python subprocess timeout
- **Cause**: Metric calculation taking >60s
- **Solution**: Increase timeout in RunPipeline, or optimize Python metrics

**Issue**: S3 permission denied
- **Cause**: AWS credentials not configured or insufficient permissions
- **Solution**: Set AWS credentials, ensure IAM role has S3 access

**Issue**: Token usage limit exceeded
- **Cause**: Token used >1000 times
- **Solution**: Re-authenticate to get new token

**Issue**: Duplicate URL error
- **Cause**: Artifact with same URL already exists
- **Solution**: Update existing artifact instead of creating new one

## Conclusion

This architecture demonstrates:
- ✅ **Separation of Concerns**: Clear layers (API, business logic, storage, metrics)
- ✅ **Extensibility**: Easy to add new metrics, storage backends, routes
- ✅ **Testability**: Multiple adapters for different test scenarios
- ✅ **Security**: JWT auth, bcrypt passwords, audit logging
- ✅ **Cloud-Native**: AWS S3 for persistence, scalable design
- ✅ **Hybrid Power**: Node.js for API + Python for ML/data science

The UML diagram captures this complex system in a comprehensible visual format, showing all major components and their relationships.
