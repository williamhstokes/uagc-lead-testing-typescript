import { expect, test, type Locator } from '@playwright/test';
import { LeadFormPage } from '../src/pages/LeadFormPage';
import { installWriteBlocker } from '../src/support/network-safety';
import { createLeadTestData } from '../src/support/test-data';

async function expectNamedControl(control: Locator): Promise<void> {
  const naming = await control.evaluate((element) => {
    const input = element as HTMLInputElement | HTMLSelectElement;
    const labels = input.labels
      ? Array.from(input.labels)
          .map((label) => label.textContent?.trim() ?? '')
          .filter(Boolean)
          .join(' ')
      : '';

    return {
      labels,
      ariaLabel: input.getAttribute('aria-label') ?? '',
      ariaLabelledBy: input.getAttribute('aria-labelledby') ?? '',
      placeholder: input.getAttribute('placeholder') ?? '',
      title: input.getAttribute('title') ?? '',
    };
  });

  expect(
    Object.values(naming).some((value) => value.trim().length > 0),
    `Control is missing a usable name: ${JSON.stringify(naming)}`,
  ).toBe(true);
}

test.describe('UAGC lead form: non-submitting smoke tests', () => {
  test('@safe page and visible lead form load', async ({ page }) => {
    const leadForm = new LeadFormPage(page);
    await leadForm.goto();

    await expect(page).toHaveTitle(/UAGC|Global Campus/i);
    await expect(await leadForm.form()).toBeVisible();
  });

  test('@safe academic and personal steps expose usable controls', async ({
    page,
  }, testInfo) => {
    const writeBlocker = await installWriteBlocker(page);
    const leadForm = new LeadFormPage(page);
    const selections = createLeadTestData(testInfo);
    await leadForm.goto();

    for (const control of await leadForm.academicControls()) {
      await expect(control).toBeVisible();
      await expect(control).toBeEnabled();
      await expectNamedControl(control);
    }

    // Selecting academic choices and clicking Next is safe. This test never
    // enters personal data and never clicks the final Submit button.
    await leadForm.prepareAcademicSelections(selections);
    writeBlocker.arm();
    await leadForm.advanceToPersonalStep();

    for (const control of await leadForm.personalControls()) {
      await expect(control).toBeVisible();
      await expect(control).toBeEnabled();
      await expectNamedControl(control);
    }

    await expect(await leadForm.submitButton()).toBeVisible();
  });

  test('@safe honeypot fields remain empty', async ({ page }, testInfo) => {
    const writeBlocker = await installWriteBlocker(page);
    const leadForm = new LeadFormPage(page);
    const selections = createLeadTestData(testInfo);
    await leadForm.goto();

    await leadForm.prepareAcademicSelections(selections);
    writeBlocker.arm();
    await leadForm.advanceToPersonalStep();

    for (const honeypot of await leadForm.honeypotInputs()) {
      await expect(honeypot).toHaveValue('');
    }
  });
});
