# Frontend E2E Testing

This directory contains automated end-to-end tests for the Artifact Registry UI.

## Prerequisites

- **Node.js** 18+ installed
- **Google Chrome** browser installed
- Backend server running (for login flow test)

## Running Tests

### Selenium UI Tests

Run both the smoke test and login flow test:

```bash
npm run test:ui
```

This command:

1. Starts the Vite dev server
2. Waits for `http://localhost:3000` to be ready
3. Runs `tests/smoke.test.js` (verifies app loads)
4. Runs `tests/login-flow.test.js` (verifies login flow)
5. Exits with code 0 if all pass, 1 if any fail

**Note:** The login flow test requires the backend to be running on port 3100.

### Lighthouse Accessibility Audit

Run the accessibility audit:

```bash
npm run test:lighthouse
```

This command:
1. Starts the Vite dev server
2. Waits for `http://localhost:3000` to be ready
3. Runs Lighthouse accessibility audit
4. Saves HTML report to `reports/accessibility-report.html`
5. Exits with code 0 if score >= 90, 1 otherwise

## Report Output

| Test | Output Location |
|------|-----------------|
| Lighthouse Accessibility | `frontend/reports/accessibility-report.html` |

## Test Descriptions

### smoke.test.js
- Navigates to the root URL
- Verifies the Navbar title "Artifact Registry" is visible
- Uses `data-testid="navbar-title"` selector

### login-flow.test.js
- Navigates to `/login`
- Enters default admin credentials
- Submits the login form
- Verifies navigation to `/search`
- Verifies "Search Artifacts" heading is visible
- Uses `data-testid` selectors for stability

### lighthouse.js
- Runs Lighthouse in headless Chrome
- Only audits the "accessibility" category
- Threshold: 90/100 minimum score
- Generates detailed HTML report

## Troubleshooting

### Chrome not found
Ensure Google Chrome is installed and in your PATH.

### Backend not running
The login flow test requires the backend. Start it with:
```bash
cd ../backend
npm run dev
```

### Port 3000 in use
The dev server uses port 3000. Kill any existing process or change the port in `vite.config.js`.
