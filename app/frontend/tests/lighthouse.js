/**
 * Lighthouse Accessibility Audit
 * Run with: node tests/lighthouse.js
 * 
 * Generates an HTML report and fails if accessibility score < 90
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const THRESHOLD = 90; // Minimum accessibility score required

async function runLighthouseAudit() {
    console.log('🔦 Running Lighthouse Accessibility Audit...');
    console.log(`   Target URL: ${BASE_URL}`);
    console.log(`   Threshold: ${THRESHOLD}`);

    let chrome;

    try {
        // Launch Chrome
        chrome = await chromeLauncher.launch({
            chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu']
        });

        console.log(`   Chrome launched on port ${chrome.port}`);

        // Run Lighthouse
        const options = {
            logLevel: 'error',
            output: 'html',
            onlyCategories: ['accessibility'],
            port: chrome.port
        };

        const result = await lighthouse(BASE_URL, options);

        // Extract scores
        const accessibilityScore = Math.round(result.lhr.categories.accessibility.score * 100);

        console.log(`\n   📊 Accessibility Score: ${accessibilityScore}/100`);

        // Create reports directory if it doesn't exist
        const reportsDir = path.join(__dirname, '..', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        // Write HTML report
        const reportPath = path.join(reportsDir, 'accessibility-report.html');
        fs.writeFileSync(reportPath, result.report);
        console.log(`   📄 Report saved: ${reportPath}`);

        // Check against threshold
        if (accessibilityScore >= THRESHOLD) {
            console.log(`\n   ✅ PASS: Score ${accessibilityScore} >= threshold ${THRESHOLD}`);
            return 0; // Success
        } else {
            console.log(`\n   ❌ FAIL: Score ${accessibilityScore} < threshold ${THRESHOLD}`);
            return 1; // Failure
        }

    } catch (error) {
        console.error('   ❌ ERROR:', error.message);
        return 1; // Failure

    } finally {
        if (chrome) {
            await chrome.kill();
        }
    }
}

// Run the audit
runLighthouseAudit().then(exitCode => {
    process.exit(exitCode);
});
