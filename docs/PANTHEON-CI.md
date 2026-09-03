# Pantheon and GitHub Actions setup

The included pull-request workflow assumes these tests live inside the Drupal code repository, for example under `qa/lead-tests/`. A separate QA repository must not push itself to Pantheon; point that workflow at an already deployed Multidev/Test URL instead.

## Required GitHub secrets

- `PANTHEON_SSH_KEY`
- `PANTHEON_MACHINE_TOKEN`
- `SANDBOX_SUBMISSION_CONFIRMATION`, set to `CREATE_TEST_LEAD_IN_SANDBOX` only after the sandbox routing and suppression controls are approved
- `TEST_PHONE`, an approved internal testing number
- `CRM_VERIFY_TOKEN`, when a downstream verification API is available

## Required or useful GitHub variables

- `PANTHEON_SITE`, the Pantheon site machine name
- `PANTHEON_TEST_URL`, the full Pantheon Test URL
- `LEAD_ENDPOINT_URL_PATTERN`, an exact regular expression for the lead endpoint
- `SAFE_SUBMISSION_HOSTS`, preferably the exact Test/Multidev hosts rather than a broad wildcard
- `TEST_EMAIL_DOMAIN`, an approved internal test domain
- `TEST_STATE_LABEL`
- `TEST_INTEREST_LABEL`
- `TEST_DEGREE_LABEL`
- `CRM_VERIFY_URL_TEMPLATE`
- `ENABLE_SANDBOX_SUBMISSION`, normally `false` until the downstream sandbox is ready

## Pull-request flow

1. GitHub checks out the Drupal repository.
2. `pantheon-systems/push-to-pantheon@0.9.3` creates or updates `pr-<number>`.
3. The workflow uses the action's `target_env_url` output as `BASE_URL`.
4. The safe suite confirms that the form renders without submitting.
5. When an endpoint pattern is configured, the mocked test fills the form and activates the browser write firewall immediately before Submit.
6. Reports, traces, screenshots, and captured test payload metadata are uploaded as GitHub artifacts.

`source_env: test` is intentional. Keep the Pantheon Test database sanitized. `clone_content: false` avoids recloning a large database on every pull-request update.

## Nightly flow

The nightly workflow runs the safe suite across Chromium, Firefox, WebKit, and mobile emulation. The real sandbox test has three independent gates:

1. `ENABLE_SANDBOX_SUBMISSION=true`
2. The target host matches `SAFE_SUBMISSION_HOSTS`
3. `SANDBOX_SUBMISSION_CONFIRMATION=CREATE_TEST_LEAD_IN_SANDBOX`

The code rejects `uagc.edu` and every `*.uagc.edu` subdomain even if those switches are set. No sandbox host is trusted by default; configure an explicit allowlist.
