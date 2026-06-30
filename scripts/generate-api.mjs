#!/usr/bin/env node
/**
 * Regenerates the typed API client from the backend OpenAPI spec.
 *
 * Strategy: fetch the live spec with Node (Node can reach `localhost`, a Docker
 * container cannot), save a snapshot, then run the official OpenAPI Generator
 * (`typescript-fetch`) inside Docker. This needs no local Java/JDK install.
 *
 * Usage:   npm run generate:api
 * Env:
 *   OPENAPI_SPEC_URL          spec location (default http://localhost:8080/swagger/v1/swagger.json)
 *   OPENAPI_GENERATOR_IMAGE   generator image/tag (default openapitools/openapi-generator-cli:latest)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SPEC_URL =
    process.env.OPENAPI_SPEC_URL ??
    'http://localhost:8080/swagger/v1/swagger.json';
const IMAGE =
    process.env.OPENAPI_GENERATOR_IMAGE ??
    'openapitools/openapi-generator-cli:latest';

const projectRoot = resolve(import.meta.dirname, '..');
const outDir = 'src/api/generated';
const specFile = 'src/api/openapi.json';
const configFile = 'openapi-generator.config.yaml';

/** Convert a project-relative path to its in-container path under /local. */
const inContainer = (p) => `/local/${p}`;

function run(cmd, args) {
    console.log(`$ ${cmd} ${args.join(' ')}`);
    execFileSync(cmd, args, { stdio: 'inherit', cwd: projectRoot });
}

// 1. Docker must be reachable.
try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
} catch {
    console.error(
        '✖ Docker is required but not reachable. Start Docker Desktop and retry.'
    );
    process.exit(1);
}

// 2. Fetch + validate the live spec, then snapshot it.
console.log(`→ Fetching OpenAPI spec: ${SPEC_URL}`);
let spec;
try {
    const res = await fetch(SPEC_URL);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    spec = await res.text();
    JSON.parse(spec); // fail fast on a non-JSON / error page
} catch (err) {
    console.error(`✖ Could not fetch/parse spec from ${SPEC_URL}: ${err.message}`);
    console.error('  Is the backend running? Override with OPENAPI_SPEC_URL=...');
    process.exit(1);
}
mkdirSync(join(projectRoot, 'src', 'api'), { recursive: true });
writeFileSync(join(projectRoot, specFile), spec);
console.log(`→ Saved spec snapshot: ${specFile}`);

// 3. Wipe previous output so removed endpoints don't linger.
rmSync(join(projectRoot, outDir), { recursive: true, force: true });

// 4. Generate via Docker (project mounted at /local).
run('docker', [
    'run',
    '--rm',
    '-v',
    `${projectRoot}:/local`,
    IMAGE,
    'generate',
    '-i',
    inContainer(specFile),
    '-g',
    'typescript-fetch',
    '-o',
    inContainer(outDir),
    '-c',
    inContainer(configFile),
]);

console.log('\n✔ API client generated into src/api/generated');
console.log('  Do not edit generated files — re-run `npm run generate:api`.');
