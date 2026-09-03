import type { Request } from '@playwright/test';
import type { ParsedRequestBody } from '../models/lead';

function addValue(
  destination: Record<string, string[]>,
  key: string,
  value: unknown,
): void {
  const normalized =
    typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);

  destination[key] ??= [];
  destination[key].push(normalized);
}

function flattenJson(
  value: unknown,
  destination: Record<string, string[]>,
  path = '$',
): void {
  if (value === null || typeof value !== 'object') {
    addValue(destination, path, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      flattenJson(item, destination, `${path}[${index}]`),
    );
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    flattenJson(item, destination, `${path}.${key}`);
  }
}

function parseUrlEncoded(raw: string): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  const params = new URLSearchParams(raw);

  for (const [key, value] of params.entries()) {
    addValue(values, key, value);
  }

  return values;
}

function parseMultipart(raw: string): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  const fieldPattern =
    /name="([^"]+)"(?:; filename="[^"]*")?\r?\n(?:Content-Type:[^\r\n]+\r?\n)?\r?\n([\s\S]*?)(?=\r?\n--)/g;

  let match: RegExpExecArray | null;

  while ((match = fieldPattern.exec(raw)) !== null) {
    const key = match[1];
    const value = match[2];

    if (key !== undefined && value !== undefined) {
      addValue(values, key, value.trim());
    }
  }

  return values;
}

export function parseRequestBody(request: Request): ParsedRequestBody {
  const contentType = request.headers()['content-type'] ?? '';
  const raw = request.postData() ?? '';
  const values: Record<string, string[]> = {};

  if (!raw) {
    return { contentType, raw, values };
  }

  try {
    if (contentType.includes('application/json')) {
      flattenJson(JSON.parse(raw) as unknown, values);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      Object.assign(values, parseUrlEncoded(raw));
    } else if (contentType.includes('multipart/form-data')) {
      Object.assign(values, parseMultipart(raw));
    }
  } catch {
    // The raw body is retained even when a vendor-specific format cannot be parsed.
  }

  return { contentType, raw, values };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9@.+_-]/g, '');
}

export function requestBodyContains(
  body: ParsedRequestBody,
  expected: string,
): boolean {
  const normalizedExpected = normalize(expected);

  if (!normalizedExpected) {
    return false;
  }

  const candidates = [
    body.raw,
    safeDecode(body.raw),
    ...Object.entries(body.values).flatMap(([key, values]) => [key, ...values]),
  ];

  return candidates.some((candidate) =>
    normalize(candidate).includes(normalizedExpected),
  );
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function requestBodyContainsPhone(
  body: ParsedRequestBody,
  phone: string,
): boolean {
  const expected = digitsOnly(phone);

  if (!expected) {
    return false;
  }

  const candidates = [
    body.raw,
    safeDecode(body.raw),
    ...Object.values(body.values).flat(),
  ];

  return candidates.some((candidate) => digitsOnly(candidate).includes(expected));
}

export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}
