# Trustworthy Model Registry _(SWE‑Phase‑2)_

A hybrid Node.js/Python registry that ingests, rates, stores and retrieves machine learning **models**, **datasets** and **code** using a metrics‑based trust framework and secure JWT‑based authentication. This project is the second phase of the ECE 461 software engineering course and implements a **Trustworthy Model Registry** on top of AWS S3 and the Hugging Face/GitHub APIs.

The system allows teams to upload artifacts, automatically compute a suite of reliability metrics, and refuse artifacts whose **net score** falls below a configurable threshold. Users can later enumerate or download artifacts, inspect individual metric scores, calculate storage costs, and manage access via JSON Web Tokens (JWT).

## Table of Contents

* [Security](#security)
* [Background](#background)
* [Install](#install)
  * [Dependencies](#dependencies)
* [Usage](#usage)
  * [Authentication](#authentication)
  * [Uploading Artifacts](#uploading-artifacts)
  * [Retrieving and Updating Artifacts](#retrieving-and-updating-artifacts)
  * [Model Rating](#model-rating)
  * [Costs, Search & Other Features](#costs-search--other-features)
  * [Reset Registry](#reset-registry)
* [Configuration](#configuration)
* [Project Structure](#project-structure)
* [API](#api)
* [Maintainers](#maintainers)
* [Thanks](#thanks)
* [Contributing](#contributing)
* [License](#license)

## Security

This registry is designed with security front‑of‑mind. All state‑changing or sensitive endpoints require a valid **X‑Authorization** header with a JWT token. Tokens are signed using a server‑side secret (`JWT_SECRET`), expire after **10 hours**, and are limited to **1 000 uses** per the course specification. If a token has expired or exceeded its usage counter, the server returns HTTP 403 and the client must re‑authenticate. User credentials are hashed using bcrypt and never stored in plain text, and each authentication event is logged for audit purposes.

The dev branch stores authentication data (users, tokens and audit logs) in a dedicated S3 bucket via the `S3AuthAdapter` for durability and multi‑node scaling. See `AWS_AUTH_SETUP.md` for instructions on provisioning a separate auth bucket, enabling encryption, lifecycle policies and IAM permissions. For development you can set `ADAPTER=local` to disable AWS dependency.

Two roles are defined: **regular users** may upload, search and download artifacts, while **administrators** can additionally register new users and call the `/reset` endpoint. The default admin user is `ece30861defaultadminuser`; change this in production by creating your own user records.

## Background

The Phase 2 project builds a **Trustworthy Model Registry** to address shortcomings of existing model hosting platforms. In Phase 1 we built a Python engine to compute reliability metrics such as **Bus Factor**, **Code Quality**, **Dataset Quality**, **License Compatibility** and more. In Phase 2 we integrate this engine into a public‑facing **REST API** and add persistent storage, authentication, and additional services. According to the course specification, the baseline requirements include:

* **Create / Read / Update / Delete (CR(U)D) operations.** The API must allow clients to upload new artifacts (models, datasets or code), retrieve metadata and content by ID, update existing entries, and delete entries【84643528329472†L196-L296】.
* **Metrics‑based ingestion.** When ingesting a model, the Python core engine computes eleven metrics and a weighted `net_score`. Only artifacts with net_score ≥ 0.5 (configurable via `MIN_NET_SCORE`) are accepted【84643528329472†L196-L296】.
* **Search & enumeration.** Clients can list all artifacts of a given type, search by exact name or regular expression, and optionally filter by version ranges (future work)【84643528329472†L196-L296】.
* **Lineage & cost.** Endpoints return a *lineage graph* showing parent models and compute the storage cost of a model and its dependencies【84643528329472†L196-L296】.
* **License checks & audit.** A license‑check endpoint verifies that a model’s open‑source license is compatible with the repository license, and an audit endpoint returns authentication events for that artifact【84643528329472†L196-L296】.
* **Reset functionality.** Administrators can reset the registry to a clean state via the `/reset` endpoint【84643528329472†L196-L296】.

Extended tracks introduce specialisations. The dev branch focuses primarily on the **Security Track**. It implements proper JWT validation, role‑based access control, token usage tracking, dedicated S3 auth storage and logging【22889110959709†L34-L78】【222253248790205†L200-L332】. The code also includes debug logging for URL scoring and improved error messages【783424844967801†L70-L138】. Future enhancements noted in the UML documentation include a web UI, regular expression search, version range support, lineage graph visualisation, license compatibility checks, partial downloads and ingestion automation【826039658913394†L352-L368】; these are not fully implemented yet.

## Install

### Dependencies

* **Node.js** (v16+ recommended) and **npm**
* **Python 3.8+**
* **AWS credentials** (if using the default `s3` adapter)
* **Git**

From the root of the repository:

    # Clone the repository
    git clone https://github.com/ECE461-2025-Team-7/SWE-Phase-2.git
    cd SWE-Phase-2

    # Python dependencies
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt  # installs requests, huggingface_hub, psutil, dulwich, transformers and coverage【167374257498413†L0-L4】

    # Node dependencies
    cd app/backend
    npm install  # installs express, @aws-sdk/client-s3, bcrypt, dotenv, jsonwebtoken, nodemon and supertest【291195935368549†L15-L24】

    # Return to repo root
    cd ../..

### Environment variables

Create a `.env` file in the `app/backend` directory with at least the following variables (defaults shown):

    # Express server port
    PORT=3100

    # Storage adapter: s3 or local
    ADAPTER=s3

    # AWS S3 settings for artifact storage
    S3_BUCKET=your-artifact-bucket
    S3_PREFIX=
    AWS_REGION=us-east-1

    # Dedicated authentication bucket (optional). If omitted, auth data is stored in S3_BUCKET under prefix auth/
    S3_AUTH_BUCKET=your-auth-bucket
    S3_AUTH_PREFIX=auth/

    # JSON Web Token secret & expiry
    JWT_SECRET=changeme
    JWT_EXPIRY=10h

    # Minimum net score required for ingestion
    MIN_NET_SCORE=0.5

    # Optional GitHub token for rate‑limited API calls
    GITHUB_TOKEN=

If you use the `s3` adapter, ensure the corresponding S3 buckets exist, encryption is enabled and the IAM role has **PutObject**, **GetObject**, **DeleteObject** and **ListBucket** permissions【222253248790205†L200-L332】. For quick local development, set `ADAPTER=local` to use in‑memory storage.

### Running the backend

    # In a separate terminal, start the Express server
    cd app/backend
    npm run dev  # uses nodemon for hot reloading

    # Or for production:
    npm start

### Running the Python engine standalone

The Python metrics engine is invoked automatically by the Node server, but you can call it directly for testing:

    python src/web_utils.py --url https://huggingface.co/google-bert/bert-base-uncased
    # Returns a JSON object containing all metric scores and the net_score.

## Usage

### Authentication

Before accessing protected endpoints you must obtain a token.

    # Authenticate with a user account (change credentials in production)
    curl -X PUT http://localhost:3100/authenticate \
      -H "Content-Type: application/json" \
      -d '{ "user": { "name": "your_user", "is_admin": true }, "secret": { "password": "your_password" } }'

    # Response example:
    "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ..."

Include the returned token in the `X‑Authorization` header for all subsequent requests.

### Uploading Artifacts

Artifacts are categorised as **model**, **dataset** or **code**. To ingest an artifact, issue a `POST` to `/artifact/<type>` with a JSON body containing the source URL. Only models whose weighted net_score is above the `MIN_NET_SCORE` threshold are accepted.

    # Upload a Hugging Face model
    TOKEN="bearer ..."  # output of /authenticate
    curl -X POST http://localhost:3100/artifact/model \
      -H "Content-Type: application/json" \
      -H "X-Authorization: $TOKEN" \
      -d '{ "url": "https://huggingface.co/google-bert/bert-base-uncased" }'

    # On success the response includes metadata (name, id, type) and data (source url, download url).

### Retrieving and Updating Artifacts

Retrieve an artifact by type and id:

    curl -H "X-Authorization: $TOKEN" \
         http://localhost:3100/artifacts/model/<artifact_id>

Update an artifact (replace existing metadata and source):

    curl -X PUT http://localhost:3100/artifacts/model/<artifact_id> \
      -H "Content-Type: application/json" \
      -H "X-Authorization: $TOKEN" \
      -d '{ "metadata": { "name": "bert-base-uncased", "id": "<artifact_id>", "type": "model" }, "data": { "url": "https://huggingface.co/google-bert/bert-base-uncased" } }'

Delete an artifact (non‑baseline). Requires authentication and will permanently remove the entry:

    curl -X DELETE http://localhost:3100/artifacts/model/<artifact_id> \
      -H "X-Authorization: $TOKEN"

### Model Rating

Use the `/artifact/model/<id>/rate` endpoint to re‑compute and fetch metric scores for a model. This triggers a Python subprocess that fetches the artifact’s URL, constructs a **ModelContext**, runs eleven metric calculators and returns a structured JSON result【826039658913394†L92-L126】.

    curl -H "X-Authorization: $TOKEN" \
         http://localhost:3100/artifact/model/<artifact_id>/rate

    # The response contains per‑metric scores and a net_score. If any metric fails, the server returns 500.

### Costs, Search & Other Features

* **Cost** – `/artifact/<type>/<id>/cost` computes the storage cost of an artifact and, if `dependency=true` is passed as a query parameter, includes its dependencies【325924662648948†L435-L466】.
* **Search by name** – `/artifact/byName/<name>` lists all artifacts with the same name. Use the `offset` query parameter for pagination【325924662648948†L548-L580】.
* **Regex search** – `/artifact/byRegEx` (POST) accepts a regular expression and returns matching artifacts. Version range search is a planned future enhancement【826039658913394†L352-L368】.
* **Lineage** – `/artifact/model/<id>/lineage` (GET) returns a lineage array representing parent relationships. A visual lineage graph is on the roadmap.
* **License check** – `/artifact/model/<id>/license-check` (POST) evaluates license compatibility between the model and the registry. This endpoint is planned.
* **Audit** – `/artifact/<type>/<id>/audit` (GET) returns authentication events associated with the artifact.

### Reset Registry

Administrators can reset all state with:

    curl -X DELETE http://localhost:3100/reset \
      -H "X-Authorization: $TOKEN"

This clears all artifacts and authentication data and returns the system to a pristine state. Use cautiously; the operation is irreversible.

## Configuration

The system uses a [layered architecture](#project-structure) with several environment variables controlling behaviour. The most important are summarised below (defaults shown):

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Port that the Express server listens on | `3100`【826039658913394†L320-L323】 |
| `ADAPTER` | Storage backend (`s3` or `local`) | `s3`【826039658913394†L323-L327】 |
| `S3_BUCKET` | AWS S3 bucket for artifact storage | *(required when `s3`)* |
| `S3_PREFIX` | Prefix for artifact objects | `""`【826039658913394†L323-L327】 |
| `S3_AUTH_BUCKET` | Dedicated S3 bucket for auth data | Same as `S3_BUCKET`【826039658913394†L323-L327】 |
| `S3_AUTH_PREFIX` | Prefix for auth data | `auth/`【826039658913394†L323-L329】 |
| `AWS_REGION` | AWS region | `us-east-1`【826039658913394†L323-L329】 |
| `JWT_SECRET` | Secret for signing JWTs | *(must be set in prod)* |
| `JWT_EXPIRY` | Token expiration | `10h`【783424844967801†L66-L76】 |
| `MIN_NET_SCORE` | Minimum net score required for ingestion | `0.5`【826039658913394†L323-L334】 |
| `GITHUB_TOKEN` | GitHub Personal Access Token to avoid rate limits | *(optional)* |

## Project Structure

The repository combines **Node.js/Express** for the API and **Python** for the metric engine. Key components include:

* `app/backend/src/server.js` – entry point for the Express application. Routes, middleware and pipelines are registered here.
* **Routes** – handle HTTP requests: `/authenticate`, `/artifact/{type}`, `/artifacts/{type}/{id}`, `/artifact/model/{id}/rate`, `/health`, `/tracks`, `/reset` and more【826039658913394†L46-L54】.
* **Middleware** – `authMiddleware.js` validates tokens and enforces the 1 000‑call limit, `http-helpers.js` validates request bodies, and `rateLimiter.js` controls external API usage.
* **Pipelines** – `DataPipeline` abstracts artifact CRUD operations and selects the appropriate storage adapter (`S3Adapter` or `localAdapter`), while `RunPipeline` invokes the Python engine and returns rating results【826039658913394†L60-L68】.
* **Storage Adapters** – `S3Adapter` persists artifacts to S3, and `localAdapter` stores them in memory for local development【826039658913394†L71-L83】. `S3AuthAdapter` manages users, tokens and audit logs【826039658913394†L84-L90】.
* **Python engine** – located in `src/`. The `URLProcessor` orchestrates metric calculation by creating a **ModelContext**, instantiating 11+ calculators, and computing a weighted net score【826039658913394†L92-L126】. Calculators include BusFactor, CodeQuality, DatasetQuality, License, PerformanceClaims, RampUp, Reproducibility, Reviewedness, Size, TreeScore and more.

For a visual overview see the UML documentation in `UML-README.md`, which describes the layered architecture, design patterns and data flows【826039658913394†L142-L169】.

## API

The complete API is defined in `ece461_fall_2025_openapi_spec.yaml`. Below is a summary of the most important endpoints. All endpoints, except for `/health`, `/health/components`, `/tracks` and `/authenticate`, require a valid `X-Authorization` header.

| Endpoint | Method | Description |
|---|---|---|
| `/authenticate` | `PUT` | Authenticate a user and obtain a JWT【325924662648948†L500-L535】. Tokens expire after 10 hours and have a 1 000‑use limit. |
| `/artifact/{type}` | `POST` | Upload an artifact (model/dataset/code). Body must include `url`. The model is rated and only persisted if its `net_score` ≥ `MIN_NET_SCORE`【84643528329472†L196-L296】. |
| `/artifacts/{type}/{id}` | `GET` | Retrieve a specific artifact by type and id【325924662648948†L206-L246】. |
| `/artifacts/{type}/{id}` | `PUT` | Update an existing artifact’s metadata and data【325924662648948†L246-L283】. |
| `/artifacts/{type}/{id}` | `DELETE` | Delete an artifact (non‑baseline)【325924662648948†L283-L308】. |
| `/artifact/model/{id}/rate` | `GET` | Compute and return all metric scores for a model artifact【325924662648948†L402-L421】. |
| `/artifact/{type}/{id}/cost` | `GET` | Calculate the storage cost of an artifact and optionally its dependencies【325924662648948†L435-L477】. |
| `/artifact/byName/{name}` | `GET` | Return metadata for all artifacts matching a given name【325924662648948†L548-L580】. |
| `/artifact/byRegEx` | `POST` | Search artifacts using a regular expression (future work). |
| `/artifact/model/{id}/lineage` | `GET` | Return a lineage array representing parent relationships (planned). |
| `/artifact/model/{id}/license-check` | `POST` | Evaluate license compatibility between the model and the registry (planned). |
| `/reset` | `DELETE` | Reset the registry to the initial state (admin only)【325924662648948†L180-L205】. |
| `/health` | `GET` | Liveness probe; returns 200 if the API is reachable【325924662648948†L34-L43】. |
| `/health/components` | `GET` | (Non‑baseline) Return per‑component health metrics【325924662648948†L45-L69】. |
| `/tracks` | `GET` | Return the specialisation tracks implemented by the team. |

See the OpenAPI file for request/response schemas and error codes.

## Maintainers

* [Aryan Banerjee](https://github.com/AB-Purdue)
* [Kabir Ray Malik](https://github.com/kabirraymalik)
* [Matthew Roxas](https://github.com/mroxas04)
* [Quincy Tordil](https://github.com/qhtordil)

Contact the maintainers via GitHub issues or by emailing your instructor.

## Thanks

This project is part of Purdue University’s **ECE 461 Software Engineering** course. We thank [Prof. Davis](http://davisjam.github.io) for the comprehensive project specification【325924662648948†L25-L30】 and the teaching staff for support. Additional thanks to the authors of the underlying open‑source libraries, including Express, the AWS SDK, bcrypt, dotenv, jsonwebtoken and the Python packages listed in `requirements.txt`【167374257498413†L0-L4】【291195935368549†L15-L24】.

## Contributing

Contributions, issues and feature requests are welcome! Please open an issue on the GitHub repository to discuss changes before submitting a pull request. When contributing:

* **Fork the repository** and create your feature branch from `dev`.
* **Write tests** covering your changes. Aim for at least 60 % coverage across Node and Python components, as required by the spec【84643528329472†L196-L296】.
* **Follow the project’s code style.** Use ESLint/Prettier for JavaScript and black/flake8 for Python.
* **Update this README** and any relevant documentation when you add features.
* **Do not include secrets** or hardcoded credentials in your commits.

All contributions are subject to review by the maintainers. By submitting a pull request you agree to license your work under the same terms as this project.

## License

This repository is licensed under the **ISC License**. See the `package.json` file for details and attribution【291195935368549†L11-L12】. Note that individual source files may contain their own license headers.
