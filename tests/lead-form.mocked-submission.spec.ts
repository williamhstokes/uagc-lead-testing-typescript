import { expect, test } from '@playwright/test';
import {
  environment,
  mockedSubmissionSkipReason,
} from '../src/config/environment';
import { LeadFormPage } from '../src/pages/LeadFormPage';
import { installMockedWriteFirewall } from '../src/support/network-safety';
import {
  requestBodyContains,
  requestBodyContainsPhone,
} from '../src/support/request-body';
import { createLeadTestData } from '../src/support/test-data';

test.describe('UAGC lead form: mocked payload contract', () => {
  test('@mocked captures the lead request without allowing an external write', async ({
    page,
  }, testInfo) => {
    const skipReason = mockedSubmissionSkipReason();
    if (skipReason) {
      test.skip(true, skipReason);
    }

    const lead = createLeadTestData(testInfo);
    const firewall = await installMockedWriteFirewall(page, lead);
    const leadForm = new LeadFormPage(page);

    await leadForm.goto();
    await leadForm.fill(lead);

    firewall.arm();
    await leadForm.submit();

    await expect
      .poll(() => firewall.captured.length, {
        timeout: environment.mockedSubmission.captureTimeoutMs,
        intervals: [250, 500, 1_000],
        message:
          'No lead request was captured. Set LEAD_ENDPOINT_URL_PATTERN to the exact endpoint if the payload is encrypted or transformed.',
      })
      .toBeGreaterThan(0);

    const captured =
      firewall.captured.find((request) =>
        requestBodyContains(request.body, lead.email),
      ) ?? firewall.captured[0];

    expect(captured).toBeDefined();
    expect(captured?.method).not.toBe('GET');
    expect(requestBodyContains(captured!.body, lead.firstName)).toBe(true);
    expect(requestBodyContains(captured!.body, lead.lastName)).toBe(true);
    expect(requestBodyContains(captured!.body, lead.email)).toBe(true);
    expect(requestBodyContainsPhone(captured!.body, lead.phone)).toBe(true);

    await testInfo.attach('captured-lead-request.json', {
      body: Buffer.from(
        JSON.stringify(
          {
            captured,
            blockedUnexpectedWrites: firewall.blocked,
          },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });
  });
});
