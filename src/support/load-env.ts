import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let loaded = false;

function unquote(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    const body = value.slice(1, -1);

    if (first === '"') {
      return body
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }

    return body;
  }

  return value;
}

/**
 * Small dependency-free .env loader.
 * Existing shell/CI environment variables always win over values in the file.
 */
export function loadEnvironmentFile(
  fileName = process.env.ENV_FILE ?? '.env',
): void {
  if (loaded) {
    return;
  }

  loaded = true;
  const filePath = resolve(process.cwd(), fileName);

  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');

  for (const originalLine of content.split(/\r?\n/)) {
    let line = originalLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    if (line.startsWith('export ')) {
      line = line.slice('export '.length).trim();
    }

    const separator = line.indexOf('=');

    if (separator < 1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    if (process.env[key] === undefined) {
      process.env[key] = unquote(rawValue);
    }
  }
}

loadEnvironmentFile();
