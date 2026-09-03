# UAGC lead testing automation

A VS Code-ready TypeScript project for testing UAGC lead forms with Playwright. It supports three deliberately separated modes:

1. **Safe smoke tests:** inspect rendering, controls, accessibility naming, and honeypots without clicking Submit. A dormant write blocker is armed before any Next/Continue action.
2. **Mocked payload-contract test:** fill the form, arm a browser-level write firewall, capture the lead request, and fulfill it locally. External POST/PUT/PATCH/DELETE requests are blocked after the firewall is armed.
3. **Real sandbox integration:** create one controlled test lead only on an approved non-production host, then optionally verify it through a secured CRM/lead-platform API.

The public UAGC pages currently contain multiple form variants and multiple fields labeled “Leave this field blank.” The page object therefore selects a visible form and never bulk-fills every input.

## Prerequisites

- Node.js 22, 24, or 26
- Visual Studio Code
- The official **Playwright Test for VS Code** extension from Microsoft
- Access to a Pantheon Multidev or Test environment for submission testing

## Start in VS Code

### 1. Open the project

```powershell
cd C:\path\to\uagc-lead-testing-typescript
code .
```

### 2. Bootstrap on Windows

From the VS Code terminal, the included PowerShell helper creates `.env`, installs dependencies, and installs Chromium:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup.ps1
```

Install all three browsers instead:

```powershell
.\setup.ps1 -AllBrowsers
```

You may also run **Terminal → Run Task → Lead Tests: Bootstrap Windows project**.

### 3. Create the local environment file manually

PowerShell:

```powershell
Copy-Item .env.example .env
```

Command Prompt:

```bat
copy .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

The defaults point to the public request-information page, but only the non-submitting suite is enabled. Any write request triggered while advancing a two-step form is blocked.

### 4. Install dependencies and browsers manually

```bash
npm install
npm run install:browsers
```

To save space while starting, install Chromium only:

```bash
npx playwright install chromium
```

After the first successful install, commit the generated `package-lock.json`. Then replace `npm install` with `npm ci` in the GitHub workflows for fully locked CI installs.

### 5. Discover the current form markup

```bash
npm run discover
```

This reads the page without submitting and writes:

```text
artifacts/form-discovery.json
```

Use that report to identify:

- Which form index is visible
- Form action and method
- Input names, IDs, labels, and placeholders
- Hidden tracking fields
- Whether the form is inside an iframe

### 6. Run the safe smoke tests

```bash
npm test
```

Watch the test in a real browser:

```bash
npm run test:headed
```

Use Playwright's interactive test explorer:

```bash
npm run test:ui
```

## Recommended first Drupal change

Add stable `data-qa` attributes to the Drupal form. See:

```text
docs/DRUPAL-TEST-HOOKS.md
```

Then narrow the test to the intended form placement:

```dotenv
FORM_CONTAINER_SELECTOR=[data-qa="lead-form"][data-placement="request-information-page"]
```

This prevents theme-class or responsive-layout changes from turning the test suite into a selector whack-a-mole arcade.

## Run the mocked payload-contract test

Use Pantheon Multidev or Test first. Inspect the browser Network panel on that approved environment and identify the exact lead endpoint.

Update `.env`:

```dotenv
BASE_URL=https://pr-123-your-site.pantheonsite.io
TARGET_ENV=multidev
ENABLE_MOCKED_SUBMISSION=true
LEAD_ENDPOINT_URL_PATTERN=^https://lead-sandbox\.example\.edu/api/v1/leads$
TEST_STATE_LABEL=Arizona
TEST_INTEREST_LABEL=
TEST_DEGREE_LABEL=
```

Run:

```bash
npm run test:mocked
```

The firewall is installed before navigation but remains dormant while the page loads. It is armed immediately before Submit. After that point:

- A request containing the unique test identity, or matching the configured endpoint pattern, is captured and fulfilled locally.
- Unexpected write requests are aborted.
- A GET containing test identity is aborted to prevent query-string leakage.
- Service workers are blocked in Playwright configuration so they cannot quietly sidestep the route guard.

The captured request is attached to the Playwright report as `captured-lead-request.json`.

The live UAGC host requires the additional `ALLOW_LIVE_MOCKED_SUBMISSION=true` switch. Keep that switch false until the team has reviewed the firewall and endpoint pattern. A Multidev is the preferred target.

## Run one real sandbox integration test

This mode is intentionally harder to enable. The server-side Pantheon environment must already route leads to a CRM or lead-platform sandbox and suppress advisor calls, SMS, email nurture, and production reporting.

Example `.env`:

```dotenv
BASE_URL=https://test-your-site.pantheonsite.io
TARGET_ENV=test
ENABLE_SANDBOX_SUBMISSION=true
SANDBOX_SUBMISSION_CONFIRMATION=CREATE_TEST_LEAD_IN_SANDBOX
SAFE_SUBMISSION_HOSTS=test-your-site.pantheonsite.io
TEST_EMAIL_DOMAIN=qa-leads.your-approved-domain.edu
TEST_PHONE=4805550100
CRM_VERIFY_URL_TEMPLATE=https://qa-api.example.edu/leads/{emailEncoded}
CRM_VERIFY_TOKEN=replace-with-a-local-secret
```

Run:

```bash
npm run test:sandbox
```

The project refuses real submissions when:

- The hostname is `uagc.edu` or any `*.uagc.edu` subdomain
- `TARGET_ENV=live`
- `SAFE_SUBMISSION_HOSTS` is empty or the hostname is outside its explicit allowlist
- The exact confirmation token is missing
- The email domain is still `example.invalid`

## Useful commands

| Command | Purpose |
|---|---|
| `npm run discover` | Inventory forms and controls without submitting |
| `npm test` | Run Chromium safe smoke tests |
| `npm run test:headed` | Run safe tests with a visible browser |
| `npm run test:ui` | Open Playwright UI Mode |
| `npm run test:cross-browser` | Run safe tests in desktop and mobile projects |
| `npm run test:mocked` | Capture and validate a lead request locally |
| `npm run test:sandbox` | Create one approved non-production test lead |
| `npm run typecheck` | Run strict TypeScript checking |
| `npm run report` | Open the most recent HTML report |

## Project structure

```text
.
├── .github/workflows/
│   ├── lead-tests-pr.yml
│   └── lead-tests-nightly.yml
├── .vscode/
│   ├── extensions.json
│   ├── settings.json
│   └── tasks.json
├── docs/
│   ├── DRUPAL-TEST-HOOKS.md
│   └── PANTHEON-CI.md
├── src/
│   ├── config/
│   │   ├── environment.ts
│   │   └── selectors.ts
│   ├── models/lead.ts
│   ├── pages/LeadFormPage.ts
│   └── support/
│       ├── load-env.ts
│       ├── network-safety.ts
│       ├── request-body.ts
│       └── test-data.ts
├── tests/
│   ├── form-discovery.spec.ts
│   ├── lead-form.safe-smoke.spec.ts
│   ├── lead-form.mocked-submission.spec.ts
│   └── lead-form.sandbox-integration.spec.ts
├── .env.example
├── setup.ps1
├── package.json
├── playwright.config.ts
└── tsconfig.json
```

## Adapting selectors

The lookup order is:

1. Stable `data-qa` attributes
2. Accessible labels and roles
3. Current UAGC-style placeholders
4. Input names/IDs
5. Visible native-select position as a temporary fallback

When a test cannot locate a field:

1. Run `npm run discover`.
2. Open `artifacts/form-discovery.json`.
3. Prefer adding a stable Drupal `data-qa` hook.
4. Otherwise update `src/config/selectors.ts`.
5. Use `FORM_CONTAINER_SELECTOR` when several form placements are visible.

## Two-step forms

`LeadFormPage.fill()` selects state, area of interest, and degree first. When the personal fields are not yet visible, it looks for a visible Next or Continue button and advances to the second step before entering name, phone, and email. The non-submitting smoke suite follows the same first-step path but never enters personal data or clicks the final Submit button.

## Endpoint and CRM contract work still required

The code cannot know UAGC's private lead endpoint, success response schema, CRM field names, or downstream verification API from public markup. Before enabling mocked or sandbox submission, supply:

- The exact non-production lead endpoint pattern
- A mocked success body that the frontend accepts
- Approved state/interest/degree combinations
- An internal test email domain and phone number
- The CRM verification URL and authentication scheme, when available
- Server-side test routing and suppression rules

## CI setup

The included pull-request workflow is a template for the **Drupal code repository**. It uses Pantheon's `push-to-pantheon` action, reads its `target_env_url` output, and runs the safe suite against the generated Multidev. If this test project remains in a separate QA repository, remove the deploy step and provide an existing Pantheon URL as `BASE_URL`. See:

```text
docs/PANTHEON-CI.md
```

The nightly workflow runs cross-browser checks against Pantheon Test and conditionally runs one sandbox lead test.

## Security rules

- Never use real prospect or student data.
- Never put CRM tokens in `.env.example`, source control, Drupal configuration export, or workflow YAML.
- Keep Playwright reports and traces in trusted storage; they can contain request bodies and tokens.
- Do not let a browser-supplied `is_test_lead` flag control production routing by itself.
- Keep the production synthetic test out of this starter until admissions, compliance, CRM, analytics, and marketing teams approve suppression, cleanup, ownership, and alerting.
