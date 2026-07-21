import { env } from './env.generated';

/**
 * Production environment.
 *
 * Swapped in for `environment.ts` via `fileReplacements` in angular.json for
 * the `production` build configuration (the default target of `ng build`).
 *
 * Values come from `.env` — see `environment.ts`. On CI, set the variables in
 * the build environment instead of committing a file: the real environment
 * takes precedence over `.env`, so `GOONG_MAPS_KEY=… npm run build` is enough.
 */
export const environment = {
    production: true,
    apiBaseUrl: env.API_BASE_URL,
    goongMapsKey: env.GOONG_MAPS_KEY,
    goongPlacesKey: env.GOONG_PLACES_KEY,
};
