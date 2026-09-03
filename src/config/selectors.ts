/**
 * Stable data-qa hooks are listed first. Accessible labels and current UAGC-style
 * placeholders/names are fallbacks until the Drupal forms receive those hooks.
 */
export const selectors = Object.freeze({
  form: [
    '[data-qa="lead-form"]',
    'form:has(input[autocomplete="given-name"])',
    'form:has(input[placeholder*="First Name" i])',
    'form:has(input[name*="first_name" i])',
    'form:has(input[name*="firstname" i])',
    'form:has(select[name*="state" i]):has(select[name*="degree" i], select[name*="program" i])',
    'form:has(select[id*="state" i]):has(select[id*="degree" i], select[id*="program" i])',
    'form:has(button:has-text("Request Information"))',
  ],

  firstName: [
    '[data-qa="lead-first-name"]',
    'input[autocomplete="given-name"]',
    'input[placeholder*="First Name" i]',
    'input[name*="first_name" i]',
    'input[name*="firstname" i]',
  ],

  lastName: [
    '[data-qa="lead-last-name"]',
    'input[autocomplete="family-name"]',
    'input[placeholder*="Last Name" i]',
    'input[name*="last_name" i]',
    'input[name*="lastname" i]',
  ],

  email: [
    '[data-qa="lead-email"]',
    'input[type="email"]',
    'input[autocomplete="email"]',
    'input[placeholder*="Email" i]',
    'input[name*="email" i]',
  ],

  phone: [
    '[data-qa="lead-phone"]',
    'input[type="tel"]',
    'input[autocomplete="tel"]',
    'input[placeholder*="123 123 1234" i]',
    'input[placeholder*="Phone" i]',
    'input[name*="phone" i]',
  ],

  state: [
    '[data-qa="lead-state"]',
    'select[name*="state" i]',
    'select[id*="state" i]',
  ],

  interest: [
    '[data-qa="lead-interest"]',
    'select[name*="interest" i]',
    'select[id*="interest" i]',
    'select[name*="area" i]',
    'select[id*="area" i]',
  ],

  degree: [
    '[data-qa="lead-degree"]',
    'select[name*="degree" i]',
    'select[id*="degree" i]',
    'select[name*="program" i]',
    'select[id*="program" i]',
  ],

  next: [
    '[data-qa="lead-next"]',
    'button:has-text("Next")',
    'button:has-text("Continue")',
    'input[type="button"][value*="Next" i]',
  ],

  submit: [
    '[data-qa="lead-submit"]',
    'button[type="submit"]',
    'input[type="submit"]',
  ],

  consent: [
    '[data-qa="lead-consent"]',
    'input[type="checkbox"][name*="consent" i]',
    'input[type="checkbox"][id*="consent" i]',
  ],
});
