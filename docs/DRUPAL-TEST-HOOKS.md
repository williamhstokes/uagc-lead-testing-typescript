# Drupal test hooks for stable Playwright selectors

The TypeScript project has accessible-label and placeholder fallbacks, but the durable solution is to add stable `data-qa` attributes in Drupal. These attributes are contracts for automation and should not be reused for styling.

## Drupal Form API example

```php
$form['#attributes']['data-qa'] = 'lead-form';
$form['#attributes']['data-placement'] = 'request-information-page';

$form['first_name']['#attributes']['data-qa'] = 'lead-first-name';
$form['last_name']['#attributes']['data-qa'] = 'lead-last-name';
$form['phone']['#attributes']['data-qa'] = 'lead-phone';
$form['email']['#attributes']['data-qa'] = 'lead-email';
$form['state']['#attributes']['data-qa'] = 'lead-state';
$form['interest']['#attributes']['data-qa'] = 'lead-interest';
$form['degree']['#attributes']['data-qa'] = 'lead-degree';
$form['actions']['next']['#attributes']['data-qa'] = 'lead-next';
$form['actions']['submit']['#attributes']['data-qa'] = 'lead-submit';
```

Adjust the Drupal array keys to match the actual custom module or Webform element keys.

## Correlation fields

Add these only as part of an approved non-production testing design:

```php
$form['test_run_id'] = [
  '#type' => 'hidden',
  '#attributes' => [
    'data-qa' => 'lead-test-run-id',
  ],
];

$form['is_test_lead'] = [
  '#type' => 'hidden',
  '#value' => '0',
  '#attributes' => [
    'data-qa' => 'lead-test-mode',
  ],
];
```

A hidden browser field must never be the authority for bypassing production routing. The server should only honor test mode after verifying the Pantheon environment and/or a server-side secret or signature.

## Twig example

```twig
<form
  {{ attributes
    .setAttribute('data-qa', 'lead-form')
    .setAttribute('data-placement', 'request-information-page')
  }}
>
  {{ children }}
</form>
```

## Recommended placement values

- `homepage-hero`
- `homepage-inline`
- `request-information-page`
- `request-information-modal`
- `degree-page-inline`
- `mobile-sticky`

Set `FORM_CONTAINER_SELECTOR` in `.env` when a page has more than one visible form, for example:

```dotenv
FORM_CONTAINER_SELECTOR=[data-qa="lead-form"][data-placement="request-information-page"]
```
