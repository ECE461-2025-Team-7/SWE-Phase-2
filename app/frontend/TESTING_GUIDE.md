# ADA Compliance Manual Testing Guide

Follow these steps to verify the accessibility improvements made to the application.

## 1. Setup Phase
Ensure the application is running:
- **Frontend**: `http://localhost:5173` (or similar port)
- **Backend**: (Running in background)

## 2. Keyboard Navigation Testing
**Goal**: Verify the entire app is usable without a mouse.
**Tools**: Use your `Tab` key and `Enter`/`Space` keys.

*   [ ] **Focus Indicators**: Press `Tab` through each page. Verify that every interactive element (links, buttons, inputs) has a visible blue outline.
*   [ ] **Skip to Main Content**: 
    1.  Refresh the page.
    2.  Press `Tab` once.
    3.  You should see a "Skip to main content" link appear at the top left.
    4.  Press `Enter`. Focus should jump to the main content area (bypassing the navigation bar).
*   [ ] **Forms**: Tab into inputs. Verify you can type. Tab to the submit button and press `Enter`.
*   [ ] **Tabs (Search Page)**: 
    1.  Go to the Search page.
    2.  Focus on the "Query Search" tab.
    3.  Use `Enter` or `Space` to switch tabs.
    4.  Verify the content below updates.
*   [ ] **Modals (Admin/Artifact Detail)**: 
    1.  Trigger a delete or reset action.
    2.  Verify focus moves *inside* the modal dialog.
    3.  Verify you cannot tab *outside* the modal while it is open (focus trap).
    4.  Close the modal (Cancel button). Verify focus returns to the button that opened it.

## 3. Screen Reader Testing
**Goal**: Verify content is announced correctly to assistive technology.
**Tools**: NVDA (Windows), VoiceOver (Mac), or Chrome Screen Reader.

*   [ ] **Navigation**: Verify the nav bar is announced as "navigation" or "main navigation".
*   [ ] **Links**: Verify the "active" page link is announced (e.g., "Search, current page").
*   [ ] **Form Labels**: 
    1.  Focus on inputs (Login, Upload, Search).
    2.  Verify the screen reader announces the label (e.g., "Username", "Artifact Type").
    3.  *Note:* It should NOT just say "edit text".
*   [ ] **Error Messages**: 
    1.  Trigger an error (e.g., fail login, upload with empty URL).
    2.  Verify the error message is announced **immediately** (due to `role="alert"` or `aria-live`).
*   [ ] **Search Results**: 
    1.  Perform a search.
    2.  Verify the results or status (e.g., "Loading", "Table with X rows") is announced.

## 4. Visual & Color Contrast
**Goal**: Verify text is readable for users with visual impairments.
**Tools**: Visual inspection or Contrast Checker plugin.

*   [ ] **Text**: Check that gray text (e.g., hints, "Logged in as") is dark enough against the white background. We updated `#666` to `#595959`.
*   [ ] **Focus State**: Verify the focus ring is high contrast (Blue `#0066cc` against White).

## 5. Specific Component Checklist

### Login Page
*   [ ] Labels "Username" and "Password" are read out when focusing fields.
*   [ ] Incorrect password trigger announces "Invalid username or password" automatically.

### Search Page
*   [ ] Tab list announces "Search methods".
*   [ ] Table headers ("Name", "Type") are associated with the data cells.

### Upload Page
*   [ ] Hint text ("The URL will be rated...") is associated with the URL input.

### Admin Page (Admin only)
*   [ ] "Reset Registry" modal is announced as a dialog labeled "Confirm Registry Reset".
*   [ ] User table reads column headers correctly.

### History Page
*   [ ] Clickable search results can be activated with `Enter`.
