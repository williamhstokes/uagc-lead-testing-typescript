import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { environment } from '../src/config/environment';

interface DiscoveredControl {
  tag: string;
  type: string;
  id: string;
  name: string;
  value: string;
  placeholder: string;
  autocomplete: string;
  required: boolean;
  disabled: boolean;
  visible: boolean;
  dataQa: string;
  labels: string[];
}

interface DiscoveredForm {
  index: number;
  visible: boolean;
  id: string;
  name: string;
  action: string;
  method: string;
  dataQa: string;
  className: string;
  textSample: string;
  controls: DiscoveredControl[];
}

test('discover lead forms without submitting anything @discovery', async ({
  page,
}, testInfo) => {
  await page.goto(environment.leadFormPath, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();

  const forms = await page.locator('form').evaluateAll((elements) =>
    elements.map((element, index): DiscoveredForm => {
      const form = element as HTMLFormElement;
      const visible = Boolean(
        form.offsetWidth || form.offsetHeight || form.getClientRects().length,
      );

      const controls = Array.from(
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input, select, textarea',
        ),
      ).map((control): DiscoveredControl => {
        const labels = 'labels' in control && control.labels
          ? Array.from(control.labels)
              .map((label) => label.textContent?.replace(/\s+/g, ' ').trim() ?? '')
              .filter(Boolean)
          : [];

        return {
          tag: control.tagName.toLowerCase(),
          type: control instanceof HTMLInputElement ? control.type : '',
          id: control.id,
          name: control.getAttribute('name') ?? '',
          value: control instanceof HTMLSelectElement
            ? control.value
            : control.getAttribute('value') ?? '',
          placeholder: control.getAttribute('placeholder') ?? '',
          autocomplete: control.getAttribute('autocomplete') ?? '',
          required: control.hasAttribute('required'),
          disabled: control.hasAttribute('disabled'),
          visible: Boolean(
            control.offsetWidth ||
              control.offsetHeight ||
              control.getClientRects().length,
          ),
          dataQa: control.getAttribute('data-qa') ?? '',
          labels,
        };
      });

      return {
        index,
        visible,
        id: form.id,
        name: form.getAttribute('name') ?? '',
        action: form.action,
        method: form.method,
        dataQa: form.getAttribute('data-qa') ?? '',
        className: form.className,
        textSample: form.innerText.replace(/\s+/g, ' ').trim().slice(0, 500),
        controls,
      };
    }),
  );

  const discovery = {
    generatedAt: new Date().toISOString(),
    pageUrl: page.url(),
    pageTitle: await page.title(),
    totalForms: forms.length,
    visibleForms: forms.filter((form) => form.visible).length,
    forms,
    iframes: await page.locator('iframe').evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.id,
        name: element.getAttribute('name') ?? '',
        title: element.getAttribute('title') ?? '',
        src: element.getAttribute('src') ?? '',
      })),
    ),
  };

  const artifactsDirectory = resolve(process.cwd(), 'artifacts');
  mkdirSync(artifactsDirectory, { recursive: true });
  const outputPath = resolve(artifactsDirectory, 'form-discovery.json');
  writeFileSync(outputPath, JSON.stringify(discovery, null, 2), 'utf8');

  await testInfo.attach('form-discovery.json', {
    path: outputPath,
    contentType: 'application/json',
  });

  console.log(`\nDiscovery written to ${outputPath}`);
  console.log(
    `Found ${discovery.totalForms} forms; ${discovery.visibleForms} are visible.`,
  );
});
