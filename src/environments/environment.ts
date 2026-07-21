import { env } from './env.generated';

/**
 * Base/default environment — swapped out per build configuration via
 * `fileReplacements` in angular.json:
 *   production  → environment.production.ts   (default target of `ng build`)
 *   development → environment.development.ts  (default target of `ng serve`)
 *   local       → environment.local.ts        (gitignored; each dev's backend)
 *
 * Values come from `.env` via `env.generated.ts` (written by
 * `scripts/generate-env.mjs`, which runs before start/build/test). Each entry
 * falls back to the literal below when the variable is unset, so the app still
 * builds without a `.env`.
 *
 * `apiBaseUrl` is the backend origin read by the generated API client (see
 * `src/contract/client.ts`); the Goong keys are the map SDK (`goongMapsKey`,
 * Maptiles) and the Places REST key (`goongPlacesKey`).
 */
export const environment = {
    production: false,
    apiBaseUrl: env.API_BASE_URL || 'http://localhost:8080',
    goongMapsKey: env.GOONG_MAPS_KEY,
    goongPlacesKey: env.GOONG_PLACES_KEY,
};
