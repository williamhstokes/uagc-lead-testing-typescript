import type { TestInfo } from '@playwright/test';
import { environment } from '../config/environment';
import type { LeadTestData } from '../models/lead';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function createRunId(testInfo?: TestInfo): string {
  const source = testInfo ? slugify(testInfo.title) : 'local';
  const ciRun = process.env.GITHUB_RUN_ID ?? 'local';
  return `lead-test-${ciRun}-${source}-${Date.now()}`;
}

export function createLeadTestData(testInfo?: TestInfo): LeadTestData {
  const runId = createRunId(testInfo);
  // Keep the complete email local part below the RFC 5321 limit of 64 octets.
  const localPart = slugify(runId).slice(0, 48);

  return {
    runId,
    firstName: 'Automation',
    lastName: 'Test',
    email: `automation+${localPart}@${environment.identity.emailDomain}`,
    phone: environment.identity.phone,
    stateLabel: environment.selections.stateLabel,
    interestLabel: environment.selections.interestLabel,
    degreeLabel: environment.selections.degreeLabel,
    rnAnswer: environment.selections.rnAnswer,
    militaryAnswer: environment.selections.militaryAnswer,
    consent: true,
  };
}
