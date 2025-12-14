/**
 * Smoke Test - Verifies the app loads and key elements render
 * Run with: node tests/smoke.test.js
 */

import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runSmokeTest() {
    console.log('🔥 Running Smoke Test...');
    console.log(`   Target URL: ${BASE_URL}`);

    // Configure headless Chrome
    const options = new chrome.Options();
    options.addArguments('--headless');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-gpu');

    let driver;

    try {
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        // Navigate to the root page
        await driver.get(BASE_URL);

        // Wait for the navbar title to be visible (max 10 seconds)
        const navbarTitle = await driver.wait(
            until.elementLocated(By.css('[data-testid="navbar-title"]')),
            10000,
            'Navbar title element not found within 10 seconds'
        );

        // Verify it's displayed
        const isDisplayed = await navbarTitle.isDisplayed();
        if (!isDisplayed) {
            throw new Error('Navbar title is not visible');
        }

        // Verify text content
        const titleText = await navbarTitle.getText();
        if (!titleText.includes('Artifact Registry')) {
            throw new Error(`Expected title to contain "Artifact Registry", got: "${titleText}"`);
        }

        console.log('   ✅ PASS: App loaded and navbar title rendered correctly');
        console.log(`   ✅ Title text: "${titleText}"`);

        return 0; // Success

    } catch (error) {
        console.error('   ❌ FAIL:', error.message);
        return 1; // Failure

    } finally {
        if (driver) {
            await driver.quit();
        }
    }
}

// Run the test
runSmokeTest().then(exitCode => {
    process.exit(exitCode);
});
