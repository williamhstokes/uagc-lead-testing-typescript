import type { Page, Route } from '@playwright/test';
import { environment } from '../config/environment';
import type {
  BlockedNetworkRequest,
  CapturedNetworkRequest,
  LeadTestData,
} from '../models/lead';
import {
  parseRequestBody,
  requestBodyContains,
  requestBodyContainsPhone,
  safeDecode,
} from './request-body';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface MockedWriteFirewall {
  readonly captured: CapturedNetworkRequest[];
  readonly blocked: BlockedNetworkRequest[];
  arm(): void;
  disarm(): void;
  isArmed(): boolean;
}

export interface WriteBlocker {
  readonly blocked: BlockedNetworkRequest[];
  arm(): void;
  disarm(): void;
  isArmed(): boolean;
}

function replaceTemplateTokens(template: string, lead: LeadTestData): string {
  return template
    .replaceAll('{runId}', lead.runId)
    .replaceAll('{email}', lead.email)
    .replaceAll('{emailEncoded}', encodeURIComponent(lead.email));
}

function requestContainsIdentity(
  url: string,
  body: ReturnType<typeof parseRequestBody>,
  lead: LeadTestData,
): boolean {
  const decodedUrl = safeDecode(url);

  return (
    decodedUrl.includes(lead.email) ||
    decodedUrl.includes(lead.phone) ||
    decodedUrl.includes(lead.runId) ||
    requestBodyContains(body, lead.email) ||
    requestBodyContainsPhone(body, lead.phone) ||
    requestBodyContains(body, lead.runId) ||
    (requestBodyContains(body, lead.firstName) &&
      requestBodyContains(body, lead.lastName))
  );
}

function createEndpointPattern(): RegExp | undefined {
  const pattern = environment.mockedSubmission.endpointUrlPattern;

  if (!pattern) {
    return undefined;
  }

  try {
    return new RegExp(pattern, 'i');
  } catch (error) {
    throw new Error(
      `LEAD_ENDPOINT_URL_PATTERN is not a valid regular expression: ${String(error)}`,
    );
  }
}

async function blockRoute(
  route: Route,
  blocked: BlockedNetworkRequest[],
  reason: string,
): Promise<void> {
  const request = route.request();

  blocked.push({
    url: request.url(),
    method: request.method(),
    resourceType: request.resourceType(),
    reason,
    blockedAt: new Date().toISOString(),
  });

  await route.abort('blockedbyclient');
}

/**
 * Installs a dormant route guard before navigation. After arm() is called, every
 * POST, PUT, PATCH, and DELETE request is blocked. It is used by smoke tests that
 * may click a Next button but must never submit a lead.
 */
export async function installWriteBlocker(page: Page): Promise<WriteBlocker> {
  let armed = false;
  const blocked: BlockedNetworkRequest[] = [];

  await page.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();

    if (!armed || READ_ONLY_METHODS.has(method)) {
      await route.continue();
      return;
    }

    await blockRoute(
      route,
      blocked,
      'Write request blocked by the non-submitting smoke-test guard.',
    );
  });

  return {
    blocked,
    arm(): void {
      armed = true;
    },
    disarm(): void {
      armed = false;
    },
    isArmed(): boolean {
      return armed;
    },
  };
}

/**
 * Installs a catch-all route before navigation. Once armed, every external write
 * is either fulfilled locally as the captured lead request or blocked. No POST,
 * PUT, PATCH, or DELETE is allowed to escape from the browser.
 */
export async function installMockedWriteFirewall(
  page: Page,
  lead: LeadTestData,
): Promise<MockedWriteFirewall> {
  let armed = false;
  const captured: CapturedNetworkRequest[] = [];
  const blocked: BlockedNetworkRequest[] = [];
  const endpointPattern = createEndpointPattern();

  await page.route('**/*', async (route) => {
    const request = route.request();

    if (!armed) {
      await route.continue();
      return;
    }

    const method = request.method().toUpperCase();
    const body = parseRequestBody(request);
    const identityMatch = requestContainsIdentity(request.url(), body, lead);
    const endpointMatch = endpointPattern?.test(request.url()) ?? false;

    if (identityMatch || endpointMatch) {
      captured.push({
        url: request.url(),
        method,
        resourceType: request.resourceType(),
        body,
        matchedBy: identityMatch ? 'test-identity' : 'endpoint-pattern',
        capturedAt: new Date().toISOString(),
      });

      const responseBody = replaceTemplateTokens(
        environment.mockedSubmission.successBody,
        lead,
      );

      await route.fulfill({
        status: environment.mockedSubmission.successStatus,
        contentType: 'application/json; charset=utf-8',
        body: responseBody,
      });
      return;
    }

    if (!READ_ONLY_METHODS.has(method)) {
      await blockRoute(
        route,
        blocked,
        'Unexpected write request blocked after lead-submit firewall was armed.',
      );
      return;
    }

    const decodedUrl = safeDecode(request.url());
    if (
      decodedUrl.includes(lead.email) ||
      decodedUrl.includes(lead.phone) ||
      decodedUrl.includes(lead.runId)
    ) {
      await blockRoute(
        route,
        blocked,
        'Read request containing test identity was blocked to prevent query-string leakage.',
      );
      return;
    }

    await route.continue();
  });

  return {
    captured,
    blocked,
    arm(): void {
      armed = true;
    },
    disarm(): void {
      armed = false;
    },
    isArmed(): boolean {
      return armed;
    },
  };
}
