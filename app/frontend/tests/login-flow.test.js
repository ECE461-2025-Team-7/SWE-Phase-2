/**
 * Login Flow Test - Happy path login and navigation
 * Run with: node tests/login-flow.test.js
 * 
 * NOTE: Requires backend to be running for authentication
 */

import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Default admin credentials (from backend seed)
const TEST_USERNAME = 'ece30861defaultadminuser';
const TEST_PASSWORD = 'correcthorsebatterystaple123(!__+@**(A]]]';

async function runLoginFlowTest() {
    console.log('🔐 Running Login Flow Test...');
    console.log(`   Target URL: ${BASE_URL}/login`);

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

        // Step 1: Navigate to login page
        console.log('   Step 1: Navigating to login page...');
        await driver.get(`${BASE_URL}/login`);

        // Step 2: Wait for login form to load
        console.log('   Step 2: Waiting for login form...');
        const loginForm = await driver.wait(
            until.elementLocated(By.css('[data-testid="login-form"]')),
            10000,
            'Login form not found within 10 seconds'
        );

        // Step 3: Enter credentials
        console.log('   Step 3: Entering credentials...');
        const usernameInput = await driver.findElement(By.id('username-input'));
        const passwordInput = await driver.findElement(By.id('password-input'));

        await usernameInput.sendKeys(TEST_USERNAME);
        await passwordInput.sendKeys(TEST_PASSWORD);

        // Step 4: Submit the form
        console.log('   Step 4: Submitting login form...');
        const submitButton = await driver.findElement(By.css('[data-testid="login-submit"]'));
        await submitButton.click();

        // Step 5: Wait for navigation to search page
        console.log('   Step 5: Waiting for navigation to search page...');
        await driver.wait(
            until.urlContains('/search'),
            15000,
            'Did not navigate to /search within 15 seconds'
        );

        // Step 6: Verify the search heading is visible
        console.log('   Step 6: Verifying search page loaded...');
        const searchHeading = await driver.wait(
            until.elementLocated(By.css('[data-testid="search-heading"]')),
            10000,
            'Search heading not found within 10 seconds'
        );

        const headingText = await searchHeading.getText();
        if (!headingText.includes('Search Artifacts')) {
            throw new Error(`Expected heading "Search Artifacts", got: "${headingText}"`);
        }

        console.log('   ✅ PASS: Login successful, navigated to search page');
        console.log(`   ✅ Heading text: "${headingText}"`);

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
runLoginFlowTest().then(exitCode => {
    process.exit(exitCode);
});
