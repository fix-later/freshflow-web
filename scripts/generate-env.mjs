#!/usr/bin/env node
/**
 * Turns `.env` into a TypeScript module the browser build can import.
 *
 * The Angular bundle has no `process.env`, so values have to be baked in at
 * build time. This reads `.env` (and the real environment, which wins — that is
 * how CI injects secrets without a file) and writes
 * `src/environments/env.generated.ts`, which `environment*.ts` import.
 *
 * Runs automatically before start/build/test via the `pre*` npm scripts, and
 * fails the build when a required variable is missing rather than emitting an
 * empty value that would only surface as a broken request at runtime.
 *
 * Usage:  npm run generate:env
 * Env:    ENV_FILE   path to the env file (default `.env`)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const envFile = resolve(projectRoot, process.env.ENV_FILE ?? '.env');
const outFile = resolve(projectRoot, 'src/environments/env.generated.ts');

/** Keys read into the bundle. Anything else in `.env` is ignored. */
const KEYS = [
    'API_BASE_URL',
    'GOONG_MAPS_KEY',
    'GOONG_PLACES_KEY',
    // Delivery-side only: the cloud assets are served from. The API key and
    // secret stay on the backend, which is what mints upload signatures.
    'CLOUDINARY_CLOUD_NAME',
];

/**
 * Keys the app cannot run without. There is no literal fallback for these in
 * `environment.*.ts`, so an empty value would leave every request pointed at a
 * relative URL and fail at runtime with nothing pointing at the cause. Fail the
 * build instead.
 */
const REQUIRED = ['API_BASE_URL'];

/**
 * A production image must carry *every* key, not just the required ones.
 *
 * A bundle built without the Goong keys still boots and looks healthy: the map
 * service degrades quietly (`mapsEnabled` is false, `autocomplete()` returns
 * `[]`), so the only symptom is a map that never renders and an address box
 * that never suggests anything — with nothing in the console to say why. That
 * is a CI secret gone missing, and it should stop the build, not ship.
 *
 * `npm start` and the PR build stay permissive: a contributor without Goong
 * keys can still run the app, and pull requests from forks get no secrets at
 * all. The Dockerfile sets `STRICT_ENV=1` so only the image that actually gets
 * deployed is held to the stricter bar.
 */
const required = process.env.STRICT_ENV === '1' ? KEYS : REQUIRED;

/**
 * Minimal `KEY=VALUE` parser — enough for this file's shape, and avoids a
 * dependency. Supports `#` comments, blank lines, `export ` prefixes and
 * quoted values; does not support multi-line values.
 */
function parseEnv(contents) {
    const out = {};
    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const eq = line.indexOf('=');
        if (eq === -1) {
            continue;
        }
        const key = line
            .slice(0, eq)
            .replace(/^export\s+/, '')
            .trim();
        let value = line.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

const relativeEnvFile = process.env.ENV_FILE ?? '.env';
const fromFile = existsSync(envFile)
    ? parseEnv(readFileSync(envFile, 'utf8'))
    : {};

// The real environment wins so CI can inject secrets without writing a file.
const resolved = Object.fromEntries(
    KEYS.map((key) => [key, process.env[key] ?? fromFile[key] ?? ''])
);

const missingRequired = required.filter((key) => !resolved[key]);
if (missingRequired.length) {
    console.error(
        `✖ Missing required config: ${missingRequired.join(', ')}\n` +
            (process.env.STRICT_ENV === '1'
                ? `  This is a production image build, where every key is\n` +
                  `  mandatory. Each one is passed as a --build-arg from the\n` +
                  `  matching GitHub Actions secret, so an empty value here\n` +
                  `  means that secret is unset or misnamed:\n` +
                  missingRequired
                      .map((key) => `    Settings → Secrets → Actions → ${key}`)
                      .join('\n')
                : existsSync(envFile)
                  ? `  Set it in ${relativeEnvFile}, or pass it in the environment.`
                  : `  No ${relativeEnvFile} found.\n` +
                    `  Locally:  cp .env.example .env\n` +
                    `  In CI/Docker: pass it in the environment ` +
                    `(docker build --build-arg API_BASE_URL=…).`)
    );
    process.exit(1);
}

const body = KEYS.map(
    (key) => `    ${key}: ${JSON.stringify(resolved[key])},`
).join('\n');

writeFileSync(
    outFile,
    `/* eslint-disable */
// AUTO-GENERATED by scripts/generate-env.mjs — do not edit, do not commit.
// Regenerate with \`npm run generate:env\`; values come from .env (or the
// process environment, which takes precedence).

export const env = {
${body}
} as const;
`
);

const missing = KEYS.filter((key) => !resolved[key]);
console.log(`✔ Wrote src/environments/env.generated.ts`);
if (missing.length) {
    console.log(`  (empty, falling back to defaults: ${missing.join(', ')})`);
}
