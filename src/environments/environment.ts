/**
 * Base/default environment — swapped out per build configuration via
 * `fileReplacements` in angular.json:
 *   production  → environment.production.ts   (default target of `ng build`)
 *   development → environment.development.ts  (default target of `ng serve`)
 *   local       → environment.local.ts        (gitignored; each dev's backend)
 *
 * Only `apiBaseUrl` is consumed — the backend origin read by the generated
 * API client (see `src/contract/client.ts`).
 */
export const environment = {
    production: false,
    apiBaseUrl: 'http://localhost:8080',
};
