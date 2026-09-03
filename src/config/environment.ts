import '../support/load-env';

export type TargetEnvironment = 'local' | 'multidev' | 'test' | 'live';
export type YesNo = 'yes' | 'no';

const UAGC_PRODUCTION_DOMAIN = 'uagc.edu';
const SANDBOX_CONFIRMATION = 'CREATE_TEST_LEAD_IN_SANDBOX';

function readBoolean(name: string, fallback = false): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (value === undefined || value === '') {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(value)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(value)) {
    return false;
  }

  throw new Error(`${name} must be true or false. Received: ${process.env[name]}`);
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number. Received: ${raw}`);
  }

  return value;
}

function readYesNo(name: string, fallback: YesNo): YesNo {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (value === 'yes' || value === 'no') {
    return value;
  }

  throw new Error(`${name} must be yes or no. Received: ${value}`);
}

function normalizeBaseUrl(raw: string): string {
  const url = new URL(raw);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function normalizePath(raw: string): string {
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return raw.startsWith('/') ? raw : `/${raw}`;
}

function inferEnvironment(baseUrl: string): TargetEnvironment {
  const host = new URL(baseUrl).hostname.toLowerCase();

  if (host === 'localhost' || host === '127.0.0.1') {
    return 'local';
  }

  if (host === UAGC_PRODUCTION_DOMAIN || host.endsWith(`.${UAGC_PRODUCTION_DOMAIN}`)) {
    return 'live';
  }

  if (host.startsWith('test-')) {
    return 'test';
  }

  if (host.endsWith('.pantheonsite.io')) {
    return 'multidev';
  }

  return 'test';
}

function readTargetEnvironment(baseUrl: string): TargetEnvironment {
  const raw = process.env.TARGET_ENV?.trim().toLowerCase();

  if (!raw) {
    return inferEnvironment(baseUrl);
  }

  if (['local', 'multidev', 'test', 'live'].includes(raw)) {
    return raw as TargetEnvironment;
  }

  throw new Error(`TARGET_ENV must be local, multidev, test, or live. Received: ${raw}`);
}

function readList(name: string, fallback: string[]): string[] {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

const baseUrl = normalizeBaseUrl(process.env.BASE_URL ?? 'https://www.uagc.edu');
const targetEnvironment = readTargetEnvironment(baseUrl);

export const environment = Object.freeze({
  baseUrl,
  leadFormPath: normalizePath(
    process.env.LEAD_FORM_PATH ?? '/request-information',
  ),
  targetEnvironment,
  formContainerSelector: optional('FORM_CONTAINER_SELECTOR'),
  formIndex: Math.max(0, Math.trunc(readNumber('FORM_INDEX', 0))),

  httpCredentials: (() => {
    const username = optional('HTTP_USERNAME');
    const password = optional('HTTP_PASSWORD');

    if (!username && !password) {
      return undefined;
    }

    if (!username || !password) {
      throw new Error('HTTP_USERNAME and HTTP_PASSWORD must be supplied together.');
    }

    return Object.freeze({ username, password });
  })(),

  selections: Object.freeze({
    stateLabel: optional('TEST_STATE_LABEL') ?? 'Arizona',
    interestLabel: optional('TEST_INTEREST_LABEL'),
    degreeLabel: optional('TEST_DEGREE_LABEL'),
    rnAnswer: readYesNo('TEST_RN_ANSWER', 'no'),
    militaryAnswer: readYesNo('TEST_MILITARY_ANSWER', 'no'),
  }),

  identity: Object.freeze({
    emailDomain: optional('TEST_EMAIL_DOMAIN') ?? 'example.invalid',
    phone: optional('TEST_PHONE') ?? '4805550100',
  }),

  hiddenFields: Object.freeze({
    runIdSelector: optional('TEST_RUN_ID_FIELD_SELECTOR'),
    testModeSelector: optional('TEST_MODE_FIELD_SELECTOR'),
  }),

  mockedSubmission: Object.freeze({
    enabled: readBoolean('ENABLE_MOCKED_SUBMISSION'),
    allowLive: readBoolean('ALLOW_LIVE_MOCKED_SUBMISSION'),
    endpointUrlPattern: optional('LEAD_ENDPOINT_URL_PATTERN'),
    successStatus: Math.trunc(readNumber('MOCK_SUCCESS_STATUS', 200)),
    successBody:
      process.env.MOCK_SUCCESS_BODY?.trim() ||
      '{"success":true,"status":"received","leadId":"{runId}"}',
    captureTimeoutMs: readNumber('MOCK_CAPTURE_TIMEOUT_MS', 15_000),
  }),

  sandboxSubmission: Object.freeze({
    enabled: readBoolean('ENABLE_SANDBOX_SUBMISSION'),
    confirmation: optional('SANDBOX_SUBMISSION_CONFIRMATION'),
    requiredConfirmation: SANDBOX_CONFIRMATION,
    safeHosts: readList('SAFE_SUBMISSION_HOSTS', []),
    successSelector: optional('SUCCESS_SELECTOR'),
    successTextPattern:
      optional('SUCCESS_TEXT_PATTERN') ??
      'thank you|request received|information submitted',
    successTimeoutMs: readNumber('SUCCESS_TIMEOUT_MS', 30_000),
  }),

  crmVerification: Object.freeze({
    urlTemplate: optional('CRM_VERIFY_URL_TEMPLATE'),
    token: optional('CRM_VERIFY_TOKEN'),
    authScheme: optional('CRM_VERIFY_AUTH_SCHEME') ?? 'Bearer',
    timeoutMs: readNumber('CRM_VERIFY_TIMEOUT_MS', 120_000),
  }),
});

export function isLiveUagcHost(url = environment.baseUrl): boolean {
  const host = new URL(url).hostname.toLowerCase();
  return (
    host === UAGC_PRODUCTION_DOMAIN ||
    host.endsWith(`.${UAGC_PRODUCTION_DOMAIN}`)
  );
}

function hostMatchesPattern(host: string, pattern: string): boolean {
  const normalized = pattern.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (normalized.startsWith('*.')) {
    const suffix = normalized.slice(1);
    return host.endsWith(suffix) && host.length > suffix.length;
  }

  if (normalized.startsWith('.')) {
    return host.endsWith(normalized);
  }

  return host === normalized;
}

export function isApprovedSandboxHost(url = environment.baseUrl): boolean {
  const host = new URL(url).hostname.toLowerCase();
  return environment.sandboxSubmission.safeHosts.some((pattern) =>
    hostMatchesPattern(host, pattern),
  );
}

export function mockedSubmissionSkipReason(): string | undefined {
  if (!environment.mockedSubmission.enabled) {
    return 'Set ENABLE_MOCKED_SUBMISSION=true in .env to run the mocked payload test.';
  }

  if (isLiveUagcHost() && !environment.mockedSubmission.allowLive) {
    return (
      'Mocked submission against live UAGC is disabled. Use Pantheon Multidev/Test, ' +
      'or explicitly set ALLOW_LIVE_MOCKED_SUBMISSION=true after reviewing the write firewall.'
    );
  }

  return undefined;
}

export function sandboxSubmissionSkipReason(): string | undefined {
  if (!environment.sandboxSubmission.enabled) {
    return 'Set ENABLE_SANDBOX_SUBMISSION=true to run the real sandbox integration test.';
  }

  if (isLiveUagcHost()) {
    return 'Real lead submission is permanently blocked for uagc.edu and its subdomains.';
  }

  if (environment.targetEnvironment === 'live') {
    return 'TARGET_ENV=live cannot run the real sandbox integration test.';
  }

  if (!isApprovedSandboxHost()) {
    return (
      `The host ${new URL(environment.baseUrl).hostname} is not in SAFE_SUBMISSION_HOSTS.`
    );
  }

  if (
    environment.sandboxSubmission.confirmation !==
    environment.sandboxSubmission.requiredConfirmation
  ) {
    return (
      'Set SANDBOX_SUBMISSION_CONFIRMATION=' +
      environment.sandboxSubmission.requiredConfirmation
    );
  }

  if (environment.identity.emailDomain === 'example.invalid') {
    return (
      'Replace TEST_EMAIL_DOMAIN=example.invalid with an approved internal test domain ' +
      'before creating a sandbox lead.'
    );
  }

  return undefined;
}
