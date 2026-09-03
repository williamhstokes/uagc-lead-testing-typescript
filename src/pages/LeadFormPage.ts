import { expect, type Locator, type Page } from '@playwright/test';
import { environment, type YesNo } from '../config/environment';
import { selectors } from '../config/selectors';
import type { LeadTestData } from '../models/lead';

interface OptionSnapshot {
  label: string;
  value: string;
  disabled: boolean;
}

interface RadioSnapshot {
  index: number;
  name: string;
  id: string;
  value: string;
  label: string;
  context: string;
  visible: boolean;
}

export class LeadFormPage {
  private formLocator: Locator | undefined;
  private preSubmitUrl: string | undefined;
  private preSubmitBodyText: string | undefined;

  public constructor(private readonly page: Page) {}

  public async goto(): Promise<void> {
    const response = await this.page.goto(environment.leadFormPath, {
      waitUntil: 'domcontentloaded',
    });

    if (response && !response.ok()) {
      throw new Error(
        `Lead page returned HTTP ${response.status()}: ${response.url()}`,
      );
    }

    await this.dismissCommonOverlays();
    await this.form();
  }

  public async form(): Promise<Locator> {
    if (this.formLocator) {
      return this.formLocator;
    }

    const candidates: Locator[] = [];

    if (environment.formContainerSelector) {
      candidates.push(this.page.locator(environment.formContainerSelector));
    }

    candidates.push(...selectors.form.map((selector) => this.page.locator(selector)));

    const visibleForms = await this.visibleMatches(candidates, 15_000);
    const selected = visibleForms[environment.formIndex];

    if (!selected) {
      throw new Error(
        `Could not find visible lead form index ${environment.formIndex}. ` +
          'Run npm run discover and set FORM_CONTAINER_SELECTOR or FORM_INDEX.',
      );
    }

    this.formLocator = selected;
    return selected;
  }

  public async firstName(): Promise<Locator> {
    const form = await this.form();
    return this.requiredVisible(
      [
        form.getByTestId('lead-first-name'),
        form.getByLabel(/first name/i),
        form.getByPlaceholder(/first name/i),
        ...selectors.firstName.map((selector) => form.locator(selector)),
      ],
      'first-name input',
    );
  }

  public async lastName(): Promise<Locator> {
    const form = await this.form();
    return this.requiredVisible(
      [
        form.getByTestId('lead-last-name'),
        form.getByLabel(/last name/i),
        form.getByPlaceholder(/last name/i),
        ...selectors.lastName.map((selector) => form.locator(selector)),
      ],
      'last-name input',
    );
  }

  public async email(): Promise<Locator> {
    const form = await this.form();
    return this.requiredVisible(
      [
        form.getByTestId('lead-email'),
        form.getByLabel(/^email\b/i),
        form.getByPlaceholder(/email/i),
        ...selectors.email.map((selector) => form.locator(selector)),
      ],
      'email input',
    );
  }

  public async phone(): Promise<Locator> {
    const form = await this.form();
    return this.requiredVisible(
      [
        form.getByTestId('lead-phone'),
        form.getByLabel(/phone/i),
        form.getByPlaceholder(/123\s*123\s*1234|phone/i),
        ...selectors.phone.map((selector) => form.locator(selector)),
      ],
      'phone input',
    );
  }

  public async state(): Promise<Locator> {
    const form = await this.form();
    const named = await this.optionalVisible([
      form.getByTestId('lead-state'),
      form.getByLabel(/^state\b/i),
      form.getByRole('combobox', { name: /^state\b/i }),
      ...selectors.state.map((selector) => form.locator(selector)),
    ]);

    return named ?? this.visibleNativeSelectByIndex(0, 'state select');
  }

  public async interest(): Promise<Locator> {
    const form = await this.form();
    const named = await this.optionalVisible([
      form.getByTestId('lead-interest'),
      form.getByLabel(/area of interest|interest/i),
      form.getByRole('combobox', { name: /area of interest|interest/i }),
      ...selectors.interest.map((selector) => form.locator(selector)),
    ]);

    return named ?? this.visibleNativeSelectByIndex(1, 'area-of-interest select');
  }

  public async degree(): Promise<Locator> {
    const form = await this.form();
    const named = await this.optionalVisible([
      form.getByTestId('lead-degree'),
      form.getByLabel(/select your degree|degree|program/i),
      form.getByRole('combobox', { name: /select your degree|degree|program/i }),
      ...selectors.degree.map((selector) => form.locator(selector)),
    ]);

    return named ?? this.visibleNativeSelectByIndex(2, 'degree select');
  }

  public async submitButton(): Promise<Locator> {
    const form = await this.form();
    return this.requiredVisible(
      [
        form.getByTestId('lead-submit'),
        form.getByRole('button', {
          name: /request(?: more)? information|submit/i,
        }),
        ...selectors.submit.map((selector) => form.locator(selector)),
      ],
      'lead submit button',
    );
  }

  public async prepareAcademicSelections(
    data: Pick<
      LeadTestData,
      'stateLabel' | 'interestLabel' | 'degreeLabel'
    >,
  ): Promise<void> {
    await this.selectOption(await this.state(), data.stateLabel, 'State');
    await this.selectOption(
      await this.interest(),
      data.interestLabel,
      'Area of Interest',
    );
    await this.selectOption(await this.degree(), data.degreeLabel, 'Degree');
  }

  public async advanceToPersonalStep(): Promise<void> {
    const activeForm = await this.form();
    const firstNameBeforeNext = await this.visibleMatches(
      [
        activeForm.getByTestId('lead-first-name'),
        activeForm.getByLabel(/first name/i),
        activeForm.getByPlaceholder(/first name/i),
        ...selectors.firstName.map((selector) => activeForm.locator(selector)),
      ],
      1_000,
    );

    if (firstNameBeforeNext.length === 0) {
      const next = await this.nextButton();

      if (!next) {
        throw new Error(
          'Personal-information fields are not visible and no Next/Continue button was found.',
        );
      }

      await next.click();

      if (
        this.formLocator &&
        ((await this.formLocator.count()) === 0 ||
          !(await this.formLocator.isVisible()))
      ) {
        this.formLocator = undefined;
      }
    }

    await this.firstName();
  }

  public async fill(data: LeadTestData): Promise<void> {
    await this.prepareAcademicSelections(data);
    await this.advanceToPersonalStep();

    await (await this.firstName()).fill(data.firstName);
    await (await this.lastName()).fill(data.lastName);
    await (await this.phone()).fill(data.phone);
    await (await this.email()).fill(data.email);

    await this.setHiddenField(
      environment.hiddenFields.runIdSelector,
      data.runId,
    );
    await this.setHiddenField(
      environment.hiddenFields.testModeSelector,
      '1',
    );

    await this.answerRadio(
      /licensed\s+rn|registered\s+nurse|\brn\b/i,
      /(^|[_-])rn([_-]|$)|nurse/i,
      data.rnAnswer,
    );
    await this.answerRadio(/military/i, /military/i, data.militaryAnswer);
    await this.checkOptionalConsent(data.consent);
    await this.assertHoneypotsEmpty();
  }

  public async submit(): Promise<void> {
    const button = await this.submitButton();
    this.preSubmitUrl = this.page.url();
    this.preSubmitBodyText = await this.page
      .locator('body')
      .innerText()
      .catch(() => '');

    await expect(button).toBeEnabled();
    await button.click();
  }

  public async waitForSuccess(): Promise<void> {
    const timeout = environment.sandboxSubmission.successTimeoutMs;

    if (environment.sandboxSubmission.successSelector) {
      await expect(
        this.page.locator(environment.sandboxSubmission.successSelector),
      ).toBeVisible({ timeout });
      return;
    }

    const pattern = new RegExp(
      environment.sandboxSubmission.successTextPattern,
      'i',
    );

    await expect
      .poll(
        async () => {
          const bodyText = await this.page.locator('body').innerText();
          const currentUrl = this.page.url();
          const bodyHasNewSuccessText =
            pattern.test(bodyText) &&
            !pattern.test(this.preSubmitBodyText ?? '');
          const changedToSuccessUrl =
            currentUrl !== this.preSubmitUrl && pattern.test(currentUrl);

          return bodyHasNewSuccessText || changedToSuccessUrl;
        },
        { timeout, intervals: [500, 1_000, 2_000] },
      )
      .toBe(true);
  }

  public async honeypotInputs(): Promise<Locator[]> {
    const form = await this.form();
    const results: Locator[] = [];
    const labelled = form.getByLabel(/leave this field blank/i);

    for (let index = 0; index < (await labelled.count()); index += 1) {
      results.push(labelled.nth(index));
    }

    const labels = form.locator('label').filter({
      hasText: /leave this field blank/i,
    });

    for (let index = 0; index < (await labels.count()); index += 1) {
      const label = labels.nth(index);
      const forId = await label.getAttribute('for');

      if (forId) {
        const escapedId = forId.replace(/([ #;?%&,.+*~\\':"!^$\[\]()=>|/@])/g, '\\$1');
        const input = form.locator(`#${escapedId}`);
        if ((await input.count()) > 0) {
          results.push(input.first());
        }
      } else {
        const nested = label.locator('input, textarea');
        if ((await nested.count()) > 0) {
          results.push(nested.first());
        }
      }
    }

    return this.uniqueLocators(results);
  }

  public async academicControls(): Promise<Locator[]> {
    return [await this.state(), await this.interest(), await this.degree()];
  }

  public async personalControls(): Promise<Locator[]> {
    return [
      await this.firstName(),
      await this.lastName(),
      await this.phone(),
      await this.email(),
    ];
  }

  private async nextButton(): Promise<Locator | undefined> {
    const form = await this.form();
    return this.optionalVisible([
      form.getByTestId('lead-next'),
      form.getByRole('button', { name: /next|continue/i }),
      ...selectors.next.map((selector) => form.locator(selector)),
    ]);
  }

  private async checkOptionalConsent(shouldConsent: boolean): Promise<void> {
    if (!shouldConsent) {
      return;
    }

    const form = await this.form();
    const consent = await this.optionalVisible([
      form.getByTestId('lead-consent'),
      form.getByLabel(/consent|agree/i),
      ...selectors.consent.map((selector) => form.locator(selector)),
    ]);

    if (consent && (await consent.getAttribute('type')) === 'checkbox') {
      if (!(await consent.isChecked())) {
        await consent.check();
      }
    }
  }

  private async answerRadio(
    questionPattern: RegExp,
    fieldPattern: RegExp,
    answer: YesNo,
  ): Promise<boolean> {
    const form = await this.form();
    const radios = form.locator('input[type="radio"]');
    const snapshots: RadioSnapshot[] = [];

    for (let index = 0; index < (await radios.count()); index += 1) {
      const radio = radios.nth(index);
      const snapshot = await radio.evaluate((element, radioIndex) => {
        const input = element as HTMLInputElement;
        const labels = input.labels
          ? Array.from(input.labels)
              .map((label) => label.textContent?.trim() ?? '')
              .filter(Boolean)
              .join(' ')
          : '';
        const contextElement = input.closest(
          'fieldset, [role="radiogroup"], .form-radios, .js-form-item, .form-item',
        );

        return {
          index: radioIndex,
          name: input.name ?? '',
          id: input.id ?? '',
          value: input.value ?? '',
          label: labels,
          context: contextElement?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          visible: Boolean(
            input.offsetWidth || input.offsetHeight || input.getClientRects().length,
          ),
        };
      }, index);

      snapshots.push(snapshot);
    }

    const answerPattern =
      answer === 'yes' ? /^(yes|y|1|true)$/i : /^(no|n|0|false)$/i;

    const scored = snapshots
      .map((snapshot) => {
        const fieldText = `${snapshot.name} ${snapshot.id}`;
        let score = 0;

        if (fieldPattern.test(fieldText)) score += 6;
        if (questionPattern.test(snapshot.context)) score += 4;
        if (answerPattern.test(snapshot.label.trim())) score += 6;
        if (answerPattern.test(snapshot.value.trim())) score += 3;
        if (snapshot.visible) score += 1;

        return { snapshot, score };
      })
      .filter(({ score }) => score >= 7)
      .sort((left, right) => right.score - left.score);

    const selected = scored[0]?.snapshot;

    if (!selected) {
      return false;
    }

    const radio = radios.nth(selected.index);
    await radio.check({ force: !selected.visible });
    return true;
  }

  private async setHiddenField(
    selector: string | undefined,
    value: string,
  ): Promise<void> {
    if (!selector) {
      return;
    }

    const form = await this.form();
    const field = form.locator(selector).first();

    if ((await field.count()) === 0) {
      return;
    }

    await field.evaluate((element, nextValue) => {
      const input = element as HTMLInputElement;
      input.value = nextValue;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  private async assertHoneypotsEmpty(): Promise<void> {
    for (const honeypot of await this.honeypotInputs()) {
      await expect(honeypot).toHaveValue('');
    }
  }

  private async selectOption(
    control: Locator,
    preferredLabel: string | undefined,
    fieldName: string,
  ): Promise<void> {
    const tagName = await control.evaluate((element) =>
      element.tagName.toLowerCase(),
    );

    if (tagName !== 'select') {
      throw new Error(
        `${fieldName} is not a native <select>. Add a data-qa hook and a custom ` +
          'combobox handler in LeadFormPage.selectOption().',
      );
    }

    const options = await this.waitForUsableOptions(control, fieldName);
    let selected: OptionSnapshot | undefined;

    if (preferredLabel) {
      const normalized = preferredLabel.trim().toLowerCase();
      selected = options.find(
        (option) => option.label.trim().toLowerCase() === normalized,
      );
      selected ??= options.find((option) =>
        option.label.trim().toLowerCase().includes(normalized),
      );

      if (!selected) {
        throw new Error(
          `${fieldName} option "${preferredLabel}" was not found. Available options: ` +
            options.map((option) => option.label).join(', '),
        );
      }
    } else {
      selected = options[0];
    }

    if (!selected) {
      throw new Error(`${fieldName} has no usable option.`);
    }

    await control.selectOption({ value: selected.value });
    await expect(control).toHaveValue(selected.value);
  }

  private async waitForUsableOptions(
    select: Locator,
    fieldName: string,
  ): Promise<OptionSnapshot[]> {
    let options: OptionSnapshot[] = [];

    await expect
      .poll(
        async () => {
          options = await select.locator('option').evaluateAll((elements) =>
            elements
              .map((element) => {
                const option = element as HTMLOptionElement;
                return {
                  label: option.textContent?.replace(/\s+/g, ' ').trim() ?? '',
                  value: option.value,
                  disabled: option.disabled,
                };
              })
              .filter((option) => {
                const placeholder =
                  !option.value ||
                  /^(select|choose|please|--)/i.test(option.label.trim());
                return !option.disabled && !placeholder;
              }),
          );

          return options.length;
        },
        {
          timeout: 15_000,
          intervals: [200, 500, 1_000],
          message: `${fieldName} did not load a usable option.`,
        },
      )
      .toBeGreaterThan(0);

    return options;
  }

  private async visibleNativeSelectByIndex(
    visibleIndex: number,
    description: string,
  ): Promise<Locator> {
    const form = await this.form();
    const visible: Locator[] = [];
    const selects = form.locator('select');

    for (let index = 0; index < (await selects.count()); index += 1) {
      const select = selects.nth(index);
      if (await select.isVisible()) {
        visible.push(select);
      }
    }

    const selected = visible[visibleIndex];

    if (!selected) {
      throw new Error(
        `Could not find ${description} at visible select index ${visibleIndex}. ` +
          'Run npm run discover and update src/config/selectors.ts.',
      );
    }

    return selected;
  }

  private async requiredVisible(
    candidates: Locator[],
    description: string,
  ): Promise<Locator> {
    const matches = await this.visibleMatches(candidates, 15_000);
    const selected = matches[0];

    if (!selected) {
      throw new Error(
        `Could not find ${description}. Run npm run discover and update the selectors.`,
      );
    }

    return selected;
  }

  private async optionalVisible(
    candidates: Locator[],
  ): Promise<Locator | undefined> {
    const matches = await this.visibleMatches(candidates, 0);
    return matches[0];
  }

  private async visibleMatches(
    candidates: Locator[],
    timeoutMs: number,
  ): Promise<Locator[]> {
    const deadline = Date.now() + timeoutMs;

    do {
      const matches: Locator[] = [];
      const seen = new Set<string>();

      for (const candidate of candidates) {
        const count = await candidate.count();

        for (let index = 0; index < count; index += 1) {
          const item = candidate.nth(index);

          if (!(await item.isVisible())) {
            continue;
          }

          const identity = await item.evaluate((element) => {
            const html = element as HTMLElement;
            const path: string[] = [];
            let current: Element | null = html;

            while (current && path.length < 8) {
              const currentTagName = current.tagName;
              const parentElement: HTMLElement | null = current.parentElement;
              const siblings: Element[] = parentElement
                ? Array.from(parentElement.children).filter(
                    (sibling: Element) => sibling.tagName === currentTagName,
                  )
                : [];
              const position = siblings.indexOf(current) + 1;
              path.unshift(
                `${currentTagName.toLowerCase()}:nth-of-type(${Math.max(position, 1)})`,
              );
              current = parentElement;
            }

            return [
              path.join('>'),
              html.id,
              html.getAttribute('name') ?? '',
              html.getAttribute('data-qa') ?? '',
            ].join('|');
          });

          if (!seen.has(identity)) {
            seen.add(identity);
            matches.push(item);
          }
        }
      }

      if (matches.length > 0 || timeoutMs === 0) {
        return matches;
      }

      await this.page.waitForTimeout(200);
    } while (Date.now() <= deadline);

    return [];
  }

  private async uniqueLocators(locators: Locator[]): Promise<Locator[]> {
    const unique: Locator[] = [];
    const seen = new Set<string>();

    for (const locator of locators) {
      const identity = await locator.evaluate((element) => {
        const html = element as HTMLElement;
        return [html.tagName, html.id, html.getAttribute('name') ?? ''].join('|');
      });

      if (!seen.has(identity)) {
        seen.add(identity);
        unique.push(locator);
      }
    }

    return unique;
  }

  private async dismissCommonOverlays(): Promise<void> {
    const buttons = [
      this.page.locator('#onetrust-accept-btn-handler'),
      this.page.getByRole('button', { name: /accept all cookies/i }),
      this.page.getByRole('button', { name: /^accept$/i }),
    ];

    for (const button of buttons) {
      const visible = await this.optionalVisible([button]);
      if (visible) {
        await visible.click().catch(() => undefined);
      }
    }
  }
}
