#!/usr/bin/env node
/**
 * Regenerates the typed API client from the backend OpenAPI spec.
 *
 * Strategy: fetch the live spec with Node (Node can reach hosts a Docker
 * container cannot), save a snapshot under `src/contract/`, then run the
 * official OpenAPI Generator (`typescript-fetch`) inside Docker. This needs
 * no local Java/JDK install.
 *
 * Usage:   npm run generate:api
 * Env:
 *   OPENAPI_SPEC_URL          spec URL (default remote FreshFlow swagger.json)
 *   OPENAPI_SPEC_FILE         optional local JSON path; skips the network fetch
 *   OPENAPI_GENERATOR_IMAGE   generator image/tag (default openapitools/openapi-generator-cli:latest)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SPEC_URL =
    process.env.OPENAPI_SPEC_URL ??
    'http://api.freshflow.fishcloud.vn/swagger/v1/swagger.json';
const SPEC_FILE_OVERRIDE = process.env.OPENAPI_SPEC_FILE;
const IMAGE =
    process.env.OPENAPI_GENERATOR_IMAGE ??
    'openapitools/openapi-generator-cli:latest';

const projectRoot = resolve(import.meta.dirname, '..');
const outDir = 'src/contract/generated';
const specFile = 'src/contract/openapi.json';
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

// 2. Load + validate the OpenAPI spec, then snapshot it.
mkdirSync(join(projectRoot, 'src', 'contract'), { recursive: true });

let spec;
if (SPEC_FILE_OVERRIDE) {
    const absolute = resolve(projectRoot, SPEC_FILE_OVERRIDE);
    console.log(`→ Reading OpenAPI spec from file: ${absolute}`);
    try {
        spec = readFileSync(absolute, 'utf8');
        JSON.parse(spec);
    } catch (err) {
        console.error(`✖ Could not read/parse ${absolute}: ${err.message}`);
        process.exit(1);
    }
} else {
    console.log(`→ Fetching OpenAPI spec: ${SPEC_URL}`);
    try {
        const res = await fetch(SPEC_URL);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        spec = await res.text();
        JSON.parse(spec); // fail fast on a non-JSON / error page
    } catch (err) {
        console.error(
            `✖ Could not fetch/parse spec from ${SPEC_URL}: ${err.message}`
        );
        console.error(
            '  Is the backend reachable? Override with OPENAPI_SPEC_URL=... or OPENAPI_SPEC_FILE=...'
        );
        process.exit(1);
    }
}

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

console.log('\n✔ API client generated into src/contract/generated');
console.log('  Do not edit generated files — re-run `npm run generate:api`.');
