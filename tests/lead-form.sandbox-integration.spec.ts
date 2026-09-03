import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  environment,
  sandboxSubmissionSkipReason,
} from '../src/config/environment';
import { LeadFormPage } from '../src/pages/LeadFormPage';
import type { LeadTestData } from '../src/models/lead';
import { createLeadTestData } from '../src/support/test-data';

function interpolateVerificationUrl(template: string, lead: LeadTestData): string {
  return template
    .replaceAll('{runId}', lead.runId)
    .replaceAll('{email}', lead.email)
    .replaceAll('{emailEncoded}', encodeURIComponent(lead.email));
}

function jsonContains(value: unknown, expected: string): boolean {
  if (typeof value === 'string') {
    return value.toLowerCase().includes(expected.toLowerCase());
  }

  if (Array.isArray(value)) {
    return value.some((item) => jsonContains(item, expected));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).some(
      ([key, item]) =>
        key.toLowerCase().includes(expected.toLowerCase()) ||
        jsonContains(item, expected),
    );
  }

  return false;
}

async function verifyDownstreamRecord(
  request: APIRequestContext,
  lead: LeadTestData,
): Promise<unknown> {
  const template = environment.crmVerification.urlTemplate;

  if (!template) {
    return undefined;
  }

  const headers: Record<string, string> = {};
  if (environment.crmVerification.token) {
    headers.Authorization =
      `${environment.crmVerification.authScheme} ` +
      environment.crmVerification.token;
  }

  const url = interpolateVerificationUrl(template, lead);
  let record: unknown;

  await expect
    .poll(
      async () => {
        const response = await request.get(url, { headers });

        if (response.status() === 404) {
          return false;
        }

        if (!response.ok()) {
          throw new Error(
            `CRM verification returned HTTP ${response.status()}: ${await response.text()}`,
          );
        }

        record = (await response.json()) as unknown;
        return jsonContains(record, lead.email) || jsonContains(record, lead.runId);
      },
      {
        timeout: environment.crmVerification.timeoutMs,
        intervals: [2_000, 5_000, 10_000],
        message: 'The sandbox lead was not found in the downstream verification API.',
      },
    )
    .toBe(true);

  return record;
}

test.describe('UAGC lead form: real sandbox integration', () => {
  test('@sandbox creates and verifies one controlled sandbox lead', async ({
    page,
    request,
  }, testInfo) => {
    const skipReason = sandboxSubmissionSkipReason();
    if (skipReason) {
      test.skip(true, skipReason);
    }

    const lead = createLeadTestData(testInfo);
    const leadForm = new LeadFormPage(page);

    await leadForm.goto();
    await leadForm.fill(lead);
    await leadForm.submit();
    await leadForm.waitForSuccess();

    const downstreamRecord = await verifyDownstreamRecord(request, lead);

    await testInfo.attach('sandbox-lead-result.json', {
      body: Buffer.from(
        JSON.stringify(
          {
            runId: lead.runId,
            email: lead.email,
            target: environment.baseUrl,
            downstreamRecord,
          },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });
  });
});
